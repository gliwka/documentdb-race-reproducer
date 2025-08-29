# MongoDB vs DocumentDB Race Condition Reproducer

This project demonstrates race conditions that occur in DocumentDB (and consequently in Azure Cosmos DB for MongoDB vCore) but not in standard MongoDB when performing concurrent upsert operations.

## 🔍 Overview

This reproducer runs 100 iterations of concurrent upsert operations on the same document using two different MongoDB connections. Each iteration:

1. **Deletes** the test document to start fresh
2. **Concurrently executes** two upsert operations:
   - Connection 1: Sets `isProxy: false` and unsets `deleted` field
   - Connection 2: Adds a `profileId` to the `profileIds` array
3. **Verifies** that both operations succeeded by checking the final document

## 🚀 Quick Start

### Prerequisites

- Node.js (v18+)
- Docker and Docker Compose
- npm or yarn

### Installation

1. Clone/download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Tests

#### Test against MongoDB (Expected: 0% data loss)

1. Start MongoDB container:
   ```bash
   npm run docker:up
   ```

2. Run the test:
   ```bash
   npm run test-mongodb
   ```

**Expected Result**: ✅ 100% success rate, 0% data loss

#### Test against DocumentDB (Expected: ~98% data loss)

1. Run the test:
   ```bash
   npm run test-documentdb
   ```

**Expected Result**: ❌ ~2% success rate, ~98% data loss

## 📊 Test Results

### MongoDB Results
```
🧪 Race Condition Test
Testing with: mongodb://localhost:27017/
✅ Run 1: Success
✅ Run 2: Success
...
✅ Run 100: Success

Results: 100 successes, 0 failures
Data loss rate: 0.0%
```

### DocumentDB Results
```
🧪 Race Condition Test
Testing with: mongodb://***:***@localhost:10260/?tls=true&tlsAllowInvalidCertificates=true
✅ Run 1: Success
❌ Run 2: Missing isProxy 
❌ Run 3: Missing profileIds
...
❌ Run 100: Missing profileIds

Results: 2 successes, 98 failures
Data loss rate: 98.0%
```

## 🛠 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run test-mongodb` | Test against MongoDB (localhost:27017) |
| `npm run test-documentdb` | Test against DocumentDB (localhost:10260) |
| `npm run docker:up` | Start both MongoDB and DocumentDB containers |
| `npm run docker:down` | Stop and remove all containers |

## 🔧 Manual Testing

You can also run tests manually with custom connection strings:

```bash
# Test with MongoDB
npx tsx minimal.ts "mongodb://localhost:27017/"

# Test with DocumentDB  
npx tsx minimal.ts "mongodb://alice:hunter2@localhost:10260/?tls=true&tlsAllowInvalidCertificates=true"

# Test with your own connection string
npx tsx minimal.ts "your-connection-string-here"
```

## 📋 Understanding the Race Condition

### What's Happening

The race condition occurs when two concurrent upsert operations target the same document:

1. **Connection 1** upserts with: `{ $unset: { deleted: "" }, $set: { isProxy: false } }`
2. **Connection 2** upserts with: `{ $addToSet: { profileIds: "some-id" } }`

### Expected Behavior (MongoDB)
Both operations should be atomic and the final document should contain both changes:
```json
{
  "_id": "test-id",
  "isProxy": false,
  "profileIds": ["some-profile-id"]
}
```

### Actual Behavior (DocumentDB)
One operation often overwrites the other, resulting in partial data loss:
```json
// Missing isProxy field
{
  "_id": "test-id", 
  "profileIds": ["some-profile-id"]
}

// OR missing profileIds field
{
  "_id": "test-id",
  "isProxy": false
}
```