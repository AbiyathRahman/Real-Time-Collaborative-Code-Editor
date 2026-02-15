# Multi-Server Architecture

## System Overview

This real-time collaborative code editor uses a **distributed architecture** that supports horizontal scaling across multiple Node.js servers using Socket.IO and Redis Pub/Sub.

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                │
│  Browser 1       Browser 2       Browser 3       Browser N      │
└───────┬─────────────┬───────────────┬────────────────┬───────────┘
        │             │               │                │
        └─────────────┴───┬───────────┴────────────────┘
                          │ Socket.IO
                          │ WebSocket
        ┌─────────────────┼─────────────────┐
        │                 │                 │
    ┌───▼────┐        ┌───▼────┐       ┌───▼────┐
    │Server A │        │Server B │       │Server C │
    │Port 3000│        │Port 3001│       │Port 3002│
    └───┬────┘        └───┬────┘       └───┬────┘
        │                 │                 │
        │   ┌─────────────┼─────────────┐   │
        │   │             │             │   │
        ├──▶│┌───────────────────────┐  │◀──┤
        │   ││   Redis Pub/Sub       │  │   │
        ├──▶││ room:*:operations     │  │◀──┤
        │   │└───────────────────────┘  │   │
        │   │             │             │   │
        └───┴─────────────┼─────────────┘───┘
                          │
                    ┌─────▼─────┐
                    │ MongoDB    │
                    │ Documents  │
                    │ Source of  │
                    │ Truth      │
                    └────────────┘
```

## Data Flow

### Single Operation Flow

```
1. CLIENT INPUT
   └─→ socket.emit('edit', { operation: {...} })

2. SERVER A RECEIVES
   ├─→ Validate operation
   ├─→ Transform against pending ops
   ├─→ Apply to document
   ├─→ Save to MongoDB
   └─→ Version++

3. BROADCAST (Two Paths)
   ├─→ Path A: socket.to('room').emit() → Clients on Server A
   │
   └─→ Path B: Redis Publish → Server B & C subscribe channels
       ├─→ Server B receives: io.to('room').emit() → Clients on Server B
       └─→ Server C receives: io.to('room').emit() → Clients on Server C

4. ALL CLIENTS
   └─→ Receive transformed operation
       └─→ Update editor state
```

## Components

### Frontend (Client)
- React with Monaco Editor
- Socket.IO client
- No knowledge of multi-server setup
- Automatic load balancing by network/proxy

### Backend Servers
- Node.js + Express
- Socket.IO for client connections
- **NEW:** Redis integration for server-to-server communication

### Database (MongoDB)
- Stores document content and versions
- Single source of truth for each room
- Used for persistence and recovery

### Message Broker (Redis)
- **NEW:** Pub/Sub for operation broadcasting
- Room-specific channels: `room:{roomId}:operations`
- Ephemeral - no persistence (not needed)
- Enables horizontal scaling

## Key Design Decisions

### 1. **Single Transformation Point**
- Only the server that RECEIVES an operation transforms it
- Transformation happens against pending ops on that server
- Transformed operation is then published to Redis
- Other servers broadcast the same transformed operation

**Why?** Consistency. All clients see operations in the same order.

### 2. **MongoDB as Source of Truth**
- Every operation is saved to DB immediately
- Operations are NOT stored in Redis
- If servers crash, data is not lost
- New servers can catch up by querying DB

### 3. **In-Memory Room State per Server**
```javascript
rooms = {
  'room-abc': {
    document: { content: '...', version: 42 },
    pendingOps: [...],        // Only this server's pending ops
    cursors: Map(...)         // Only connected users
  }
}
```
- Each server maintains its own room state
- Not synchronized across servers
- Used for local optimization and quick access
- Reset if server crashes (clients reconnect)

### 4. **Lazy Redis Subscription**
- Subscribe to room channel only when first user joins
- Unsubscribe when last user leaves
- Reduces Redis memory for rooms with no active users
- Automatic cleanup

## Operation Transformation (OT)

When Server A receives operation `op1`:
```
currentDB = { content: "hello", version: 5 }
pendingOps = [op2, op3]  // From other users on this server

Transformation:
  transformedOp = op1
  transformedOp = transform(op2, transformedOp)   // Against op2
  transformedOp = transform(op3, transformedOp)   // Against op3

Result: transformedOp is now safe to apply to content
```

The transformation algorithm handles all 4 cases:
1. insert + insert → adjust positions
2. insert + delete → adjust positions
3. delete + insert → adjust positions
4. delete + delete → adjust lengths

## Consistency Guarantees

### Within One Server
- All operations applied in order received
- Local clients see immediate feedback
- Consistency maintained

### Across Multiple Servers
- Operations published to Redis in order processed
- All servers receive operations via Redis in same order
- MongoDB version serves as tiebreaker
- **Result:** All clients eventually see same state

### Edge Cases Handled

1. **Two servers receive ops simultaneously**
   - Server A: transform op1 against local pending, apply, save v5
   - Server B: transform op2 against local pending, apply, save v5
   - When both publish to Redis, both applied on both servers
   - No conflict (OT handles it)

2. **Server down, clients reconnect to different server**
   - New server loads document from MongoDB (latest version)
   - Clients reconnect and issue their operations
   - New operations transform correctly against DB version

3. **Network delay in Redis**
   - Operations are published asynchronously
   - Each server broadcasts to local clients immediately
   - Redis delivery order is guaranteed by Redis itself
   - Eventual consistency maintained

## Scaling Performance

### Horizontal Scaling (Adding Servers)
- Add new server instance with same code
- All servers connect to same Redis/MongoDB
- Load balancer distributes clients
- **Performance:** Linear (each server handles ~100 clients)

### Vertical Scaling (Upgrading Server)
- More CPU/RAM → faster OT transformation → higher throughput
- Redis pub/sub remains bottleneck at very high scale
- Can be addressed with Redis Cluster

## Typical Workload Distribution

With 3 servers and 90 clients:
```
Server A: 30 clients
  ├─→ Room "project-1": 15 clients
  ├─→ Room "project-2": 10 clients
  └─→ Room "meeting": 5 clients

Server B: 30 clients
  ├─→ Room "project-1": 10 clients
  ├─→ Room "project-2": 12 clients
  └─→ Room "training": 8 clients

Server C: 30 clients
  ├─→ Room "project-1": 15 clients
  └─→ Room "project-2": 8 clients

Redis Channels Active:
  ├─→ room:project-1:operations
  ├─→ room:project-2:operations
  ├─→ room:meeting:operations
  └─→ room:training:operations
```

Each room has only one channel. Operations are published once and received by all servers.

## Failure Scenarios

### Server Crash
- **Client connects to different server** ✅
- Session continues (new userId)
- Document loaded from MongoDB ✅
- Operations resume normally ✅

### Redis Down
- **Server still works** ✅ (for local operations)
- **Multi-server sync fails** ❌
- **Workaround:** Single server mode until Redis restored
- **Fallback:** Clients on same server still sync via Socket.IO

### MongoDB Down
- **Can't load documents** ❌
- **Can't save operations** ❌
- **Recovery:** Restart MongoDB, operations still in Redis buffer (if implemented)
- **Current:** Would need to restart servers

### Network Partition
- **Servers in partition A** see each other (via Redis)
- **Servers in partition B** see each other (via Redis)
- **When healed** → Redis merges streams
- **Eventual consistency** through DB version mechanism

## Monitoring

### Key Metrics

1. **Redis Pub/Sub**
   ```bash
   redis-cli INFO pubsub
   ```
   - Check active channels
   - Verify subscriber count
   - Monitor memory usage

2. **Server Health**
   ```bash
   curl http://localhost:3000/health  # if added
   ```
   - Connected clients
   - Active rooms
   - Redis connection status

3. **Operation Latency**
   - Time from client emit to broadcast
   - Add timestamps to operations
   - Log in socket handlers

### Tools

```bash
# Real-time operation monitor
redis-cli SUBSCRIBE 'room:*:operations'

# Check Redis memory
redis-cli INFO memory

# Monitor Socket.IO connections
# Add to express: app.use(require('socket.io-client-next')('/diagnostic'))
```

## Future Enhancements

### Phase 1 (Current)
- ✅ Multi-server Pub/Sub
- ✅ MongoDB persistence
- ✅ Operation transformation
- ✅ Room management

### Phase 2 (Recommended)
- [ ] Redis Streams for operation history
- [ ] Health check endpoints
- [ ] Metrics/monitoring dashboard
- [ ] Graceful server shutdown with session migration
- [ ] Operation batching to reduce Redis traffic

### Phase 3 (Advanced)
- [ ] Redis Sentinel for HA
- [ ] Redis Cluster for distribution
- [ ] Operation compression
- [ ] Partial document loading (for huge files)
- [ ] Time-travel debugging with operation replay

## Migration from Single to Multi-Server

1. **Existing Single Server**
   - Already uses MongoDB for persistence ✅
   - OT implementation complete ✅

2. **Add Redis**
   - Install Redis locally: `brew install redis`
   - Update backend: `npm install ioredis`
   - Add redis/client.js module ✅
   - Update socket-handler.js ✅
   - Run locally to test multi-server

3. **Deploy Multiple Instances**
   - Use load balancer (nginx, HAProxy)
   - Point all servers to same Redis/MongoDB
   - Test with multiple clients across servers
   - Monitor Redis channel traffic

4. **No Client Changes Required**
   - Clients don't know about scaling
   - Same Socket.IO API
   - Same collaborative experience

## Testing Multi-Server Setup

### Local Testing

1. **Start services**
   ```bash
   docker-compose up -d
   ```

2. **Start multiple servers**
   ```bash
   # Terminal 1
   PORT=3000 npm start
   
   # Terminal 2  
   PORT=3001 npm start
   
   # Terminal 3
   PORT=3002 npm start
   ```

3. **Route clients manually**
   ```javascript
   // Client 1: connect to port 3000
   const socket = io('http://localhost:3000')
   
   // Client 2: connect to port 3001
   const socket = io('http://localhost:3001')
   ```

4. **Verify sync**
   - Client 1 edits → should see on Client 2 ✅
   - Client 2 edits → should see on Client 1 ✅
   - Check Redis: `redis-cli PUBSUB CHANNELS`

### Production Deployment

Use docker-compose with multiple server containers:
```yaml
services:
  server1:
    build: .
    environment:
      - PORT=3000
    depends_on:
      - redis
      - mongodb
      
  server2:
    build: .
    environment:
      - PORT=3000
    depends_on:
      - redis
      - mongodb
      
  # ... etc
```

Load balance with nginx/HAProxy to distribute clients.

