# Multi-Server Testing Guide

Quick reference for testing Redis Pub/Sub integration and multi-server broadcasting.

## Quick Start

### 1. Start Redis
```bash
# Using Docker (easiest)
docker run -d -p 6379:6379 redis:7-alpine

# Or with docker-compose
docker-compose up -d redis
```

### 2. Verify Redis is Running
```bash
redis-cli ping
# Should respond: PONG
```

### 3. Start Multiple Backend Servers
```bash
# Terminal 1 - Server A (port 3000)
cd backend
npm install
PORT=3000 npm start

# Terminal 2 - Server B (port 3001)
cd backend
PORT=3001 npm start

# Terminal 3 - Server C (port 3002)
cd backend
PORT=3002 npm start
```

### 4. Start Frontend
```bash
cd frontend/vite-project
npm install
npm run dev
# Opens on http://localhost:5173
```

## Testing Scenario 1: Single Room, Multiple Servers

### Setup
- Open 3 browser tabs
- Tab 1: `http://localhost:5173` (auto-connects to port 3000)
- Tab 2: Open browser dev console, change `io('http://localhost:3000')` → `io('http://localhost:3001')`
- Tab 3: Same, change to `io('http://localhost:3002')`

### Steps
1. All tabs join same room (e.g., "test-room")
2. User on Tab 1 types "Hello"
   - Should see on Tab 2 & 3 immediately
3. User on Tab 2 adds " World"
   - Should see on Tab 1 & 3 immediately
4. User on Tab 3 modifies content
   - Should sync to all others

### Expected Output
- **Server logs show**:
  ```
  Published operation to Redis channel room:test-room:operations
  Received operation from Redis for room test-room
  ```
- **All clients in sync** despite different servers
- **No duplicate operations**

## Testing Scenario 2: Multiple Rooms

### Setup
- Open 4 browser tabs
- Tab 1 & 2: Join room "project-a"
- Tab 3 & 4: Join room "project-b"
- Each pair connects to different server

### Steps
1. Edit in "project-a"
   - Should only sync within project-a
   - project-b unaffected
2. Edit in "project-b"
   - Should only sync within project-b
   - project-a unaffected

### Expected Output
```bash
redis-cli PUBSUB CHANNELS
# Shows:
# 1) "room:project-a:operations"
# 2) "room:project-b:operations"
```

## Monitoring Commands

### Watch All Operations
```bash
redis-cli SUBSCRIBE 'room:*:operations'
```
Output shows operations being published in real-time.

### Check Active Channels
```bash
redis-cli PUBSUB CHANNELS
```
Only shows rooms with active operations.

### Monitor Redis Memory
```bash
redis-cli INFO memory
```
Check used_memory_human, should be small (operations aren't stored).

### Check Connected Clients
```bash
redis-cli INFO clients
```
Shows connected_clients (should be 2 × number of servers).

## Debugging Tips

### See Operation Details
Add logging to socket-handler.js:
```javascript
// When publishing
console.log('Publishing to Redis:', {
  channel: redisChannelName,
  operation: transformedOp,
  version: newVersion
});

// When receiving
redisClient.subscribe(redisChannelName, (data) => {
  console.log('Received from Redis:', data);
  io.to(roomId).emit('content-changed', data);
});
```

### Check Server Logs
Each server should log:
```
Published operation to Redis channel room:abc123:operations
Received operation from Redis for room abc123
```

### Verify Database Updates
```bash
# Connect to MongoDB
mongosh

# Check documents collection
use editor_db
db.documents.findOne({ roomId: "test-room" })
```
Should show latest version and content.

## Test Cases

### ✅ Basic Sync
- [ ] Edit on server A
- [ ] Verify visible on server B
- [ ] Verify visible on server C

### ✅ Concurrent Edits
- [ ] Server A: Insert "Hello" at position 0
- [ ] Server B: Insert "World" at position 0 (same time)
- [ ] Result: Both inserts applied without conflict
- [ ] Check version increments correctly

### ✅ Room Isolation
- [ ] Create room "room1" and "room2"
- [ ] Edit in room1
- [ ] Verify room2 unaffected
- [ ] Edit in room2
- [ ] Verify room1 unaffected

### ✅ Server Disconnection
- [ ] Stop Server B
- [ ] Clients still on A & C work
- [ ] Stop Server A (all clients on C)
- [ ] Server C handles all clients
- [ ] Restart Server A
- [ ] New clients can connect

### ✅ Large Operations
- [ ] Paste 1000 lines of text
- [ ] Verify all servers receive
- [ ] Check performance in browser DevTools
- [ ] Operations should complete in <100ms

### ✅ Rapid Edits
- [ ] User types 100 characters rapidly
- [ ] Each keystroke publishes on Redis
- [ ] All servers receive all operations
- [ ] Final content matches on all clients

## Expected Server Logs

### On Connection
```
Socket.IO connection established: abc123
User-456 joined room test-room
Users in room: [{ userId: 'xyz', username: 'User-456', ... }]
Redis Subscriber connected
```

### On Edit
```
Sending operation: { type: 'insert', position: 5, text: 'h', ... }
Operation applied in room test-room: { type: 'insert', ... }
Published operation to Redis channel room:test-room:operations
```

### On Broadcast from Redis
```
Received operation from Redis for room test-room: { type: 'insert', ... }
```

### On Disconnect
```
User-456 (xyz) disconnected from room test-room
Users in room: [...]
```

## Performance Benchmarks

Typical latencies on local machine:

| Scenario | Latency | Notes |
|----------|---------|-------|
| Edit → Local broadcast | 10-20ms | Socket.IO direct |
| Edit → Redis publish | 5-10ms | Redis latency |
| Redis → Other servers | 2-5ms | Network + Redis |
| **Total single server** | **10-20ms** | Client sees immediately |
| **Total cross-server** | **25-40ms** | Depends on Redis/network |

## Troubleshooting

### Operations not syncing
1. Check Redis is running: `redis-cli ping`
2. Check servers are connected to Redis (logs show "Redis Subscriber connected")
3. Check channel is subscribed: `redis-cli PUBSUB CHANNELS`

### High latency
1. Check Redis: `redis-cli --latency`
2. Check network: `ping localhost`
3. Profile Node.js: Add `--inspect` flag
4. Check database: Monitor MongoDB response time

### Memory leak
1. Check room subscriptions cleanup: `redis-cli PUBSUB CHANNELS` should decrease
2. Monitor: `redis-cli INFO memory`
3. Check for unremoved event listeners in socket handlers

### Inconsistent state
1. Verify MongoDB has latest version
2. Check operation transformation logs
3. Ensure client is seeing all broadcasts
4. Check browser DevTools Network tab

## Load Testing

### Simple Load Test
```bash
# Terminal 1
redis-cli SUBSCRIBE 'room:*:operations'

# Terminal 2
for i in {1..100}; do
  curl -X POST http://localhost:3000/edit -d '{"op": "test"}'
done
```

### With Artillery.io
```bash
npm install -g artillery

# Create artillery.yml with scenario:
# - Connect to server
# - Join room
# - Send edit operations
# - Measure latency

artillery run artillery.yml
```

## Production Checklist

- [ ] Redis configured with persistence (AOF or RDB)
- [ ] Redis memory limits set
- [ ] MongoDB backups configured
- [ ] Server error handling for Redis failure
- [ ] Monitoring/alerting for Redis connection
- [ ] Load balancer configured
- [ ] Health check endpoints added
- [ ] Graceful shutdown implemented
- [ ] Rate limiting for operations
- [ ] CORS properly configured

