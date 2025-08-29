import { MongoClient } from 'mongodb';

interface UserDoc {
  _id: string;
  isProxy?: boolean;
  profileIds?: string[];
}

// Minimal race condition reproducer
async function testRaceCondition(connectionString: string) {
  console.log(`Testing with: ${connectionString.replace(/\/\/[^@]*@/, '//***:***@')}`);
  
  // Two separate connections with different app names
  const separator = connectionString.includes('?') ? '&' : '?';
  const client1 = new MongoClient(connectionString + separator + 'appName=Test1');
  const client2 = new MongoClient(connectionString + separator + 'appName=Test2');
  
  await client1.connect();
  await client2.connect();
  
  const db1 = client1.db('testdb');
  const db2 = client2.db('testdb');
  const collection1 = db1.collection<UserDoc>('users');
  const collection2 = db2.collection<UserDoc>('users');
  
  let successes = 0;
  let failures = 0;
  
  for (let i = 1; i <= 100; i++) {
    const userId = Math.floor(100000000 + Math.random() * 900000000).toString();
    const profileId = Math.floor(100000000 + Math.random() * 900000000).toString();
    
    // Clear document
    await collection1.deleteOne({ _id: userId });
    
    // Run concurrent upserts
    await Promise.all([
      collection1.updateOne(
        { _id: userId },
        { $unset: { deleted: "" }, $set: { isProxy: false } },
        { upsert: true }
      ),
      collection2.updateOne(
        { _id: userId },
        { $addToSet: { profileIds: profileId } },
        { upsert: true }
      )
    ]);
    
    // Check result
    const doc = await collection1.findOne({ _id: userId });
    const hasIsProxy = doc?.isProxy === false;
    const hasProfileIds = doc?.profileIds?.includes(profileId);
    
    if (hasIsProxy && hasProfileIds) {
      console.log(`✅ Run ${i}: Success`);
      console.log(`   Document: ${JSON.stringify(doc)}`);
      successes++;
    } else {
      failures++;
        console.log(`❌ Run ${i}: Missing ${!hasIsProxy ? 'isProxy' : ''} ${!hasProfileIds ? 'profileIds' : ''}`);
        console.log(`   Document: ${JSON.stringify(doc)}`);
    }
  }
  
  console.log(`\nResults: ${successes} successes, ${failures} failures`);
  console.log(`Data loss rate: ${(failures/100*100).toFixed(1)}%`);
  
  await client1.close();
  await client2.close();
}

// CLI handling
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Usage: npx ts-node src/minimal.ts <connection-string>');
  process.exit(1);
}

const connectionString = args[0];

console.log('🧪 Race Condition Test');
testRaceCondition(connectionString).catch(console.error);
