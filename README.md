# Real-Time Collaborative Code Editor

A production-grade collaborative code editor with Operational Transformation for conflict-free real-time synchronization across multiple users.

🔗 **[Live Demo](https://real-time-collaborative-code-editor-4thg6htmc.vercel.app/)** | 💻 **Try it:** Open in 3+ browser tabs


## Overview

A Google Docs-style collaborative editor for code, enabling multiple users to edit simultaneously with instant synchronization. Built to demonstrate distributed systems concepts including Operational Transformation, WebSocket state management, and horizontal scaling with Redis Pub/Sub.

## ✨ Features

- **Real-time collaboration** — Multiple users edit simultaneously with sub-100ms latency
- **Conflict-free merging** — Operational Transformation ensures consistent state across all clients
- **Multi-user cursors** — See where others are typing with color-coded indicators
- **Syntax highlighting** — Monaco Editor (VS Code's editor) with 15+ languages
- **Presence awareness** — Active users displayed with join/leave notifications
- **Shareable rooms** — Generate unique room links for instant collaboration
- **Horizontal scaling** — Redis Pub/Sub enables multi-server deployment
- **Revision history** — Every operation logged for time-travel debugging

## 🏗️ Architecture
```
┌─────────────────┐
│  React Client   │ ← Monaco Editor, Socket.io client
└────────┬────────┘
         │ WebSocket (bidirectional)
         ▼
┌─────────────────┐
│  Socket.io      │ ← Connection management, room handling
│  Server          │
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
┌────────┐ ┌─────────┐
│ Redis  │ │ MongoDB │
│ Pub/Sub│ │ Docs +  │
│        │ │ Op Log  │
└────────┘ └─────────┘
```

### Data Flow

1. User types in Monaco Editor
2. Change event captured, converted to operation
3. Operation sent to server via WebSocket
4. Server applies Operational Transformation
5. Operation saved to MongoDB operation log
6. Broadcast via Redis Pub/Sub to all servers
7. All connected clients receive and apply operation

## 🛠️ Tech Stack

**Backend:** Node.js, Express, Socket.io, MongoDB, Redis  
**Frontend:** React, Vite, Monaco Editor, Socket.io-client  
**Infrastructure:** Railway, Vercel, Docker

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB
- Redis

### Run with Docker (Recommended)
```bash
# Clone repository
git clone https://github.com/AbiyathRahman/collaborative-code-editor
cd collaborative-code-editor

# Start all services
docker compose up

# Open http://localhost:5173 in multiple browser tabs
# Use same room ID to collaborate
```

### Manual Setup
```bash
# Start MongoDB
docker run -d -p 27017:27017 mongo:7

# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Backend
cd server
npm install
cp .env.example .env
# Edit .env with MongoDB and Redis URLs
npm start

# Frontend (new terminal)
cd client
npm install
npm run dev
```

## 💡 System Design: Operational Transformation

### The Core Problem

When two users edit the same position simultaneously, naive broadcast creates divergent states:
```
Initial document: ""

User A inserts "hello" at position 0
User B inserts "world" at position 0

Without OT:
  Client A: "worldhello"
  Client B: "helloworld"
  ❌ DIVERGED

With OT:
  Both clients: "helloworld"
  ✓ CONVERGED
```

### The Solution

Operations are transformed based on concurrent operations to maintain consistency:
```javascript
function transform(op1, op2) {
  // Both are inserts at same position
  if (op1.type === 'insert' && op2.type === 'insert') {
    if (op2.position >= op1.position) {
      // Shift op2 right by length of op1's text
      op2.position += op1.text.length;
    }
  }
  return op2;
}
```

The full implementation handles:
- Insert vs Insert (with tie-breaking)
- Insert vs Delete
- Delete vs Insert
- Delete vs Delete (including overlapping ranges)

### Why OT Instead of CRDT?

**Operational Transformation** was chosen over **Conflict-free Replicated Data Types** because:
- Simpler to implement correctly for learning purposes
- Server-authoritative model is easier to reason about
- Directly prepares for "How would you build Google Docs?" interviews
- Used by Google Docs, Firebase, Etherpad

**CRDTs** are better for fully distributed, offline-first systems (like Figma, Notion).

## 📊 Performance

- **Latency:** Sub-100ms edit propagation in load testing
- **Concurrent users:** Successfully tested with 50+ simultaneous users
- **Throughput:** 1000+ operations/second per room
- **Consistency:** Strong eventual consistency guaranteed via versioned operations

*Measured with load test simulating 50 clients typing simultaneously*


## 🎯 Use Cases

- Pair programming interviews
- Code review sessions
- Teaching/tutoring
- Real-time documentation editing
- Live coding demonstrations

## 🔮 Future Enhancements

- [ ] User authentication and room permissions
- [ ] Voice/video chat integration
- [ ] AI-powered autocomplete (Claude API)
- [ ] Multiple document tabs per room
- [ ] Offline mode with operation queue
- [ ] Full undo/redo with operation inversion
- [ ] File tree and project structure
- [ ] Integrated terminal

## 📝 Environment Variables

**Server:**
```env
MONGODB_URI=mongodb://localhost:27017/collaborative-editor
REDIS_URL=redis://localhost:6379
CLIENT_URL=http://localhost:5173
PORT=3000
```

**Client:**
```env
VITE_SERVER_URL=http://localhost:3000
```

## 🎓 Learning Resources

This project demonstrates:
- Real-time bidirectional communication (WebSockets)
- Conflict resolution algorithms (Operational Transformation)
- Distributed state synchronization
- Presence tracking across clients
- Horizontal scaling with Redis Pub/Sub
- Event-driven architecture

**Recommended reading:**
- [Understanding Operational Transformation](https://en.wikipedia.org/wiki/Operational_transformation)
- [Google Wave OT Paper](https://svn.apache.org/repos/asf/incubator/wave/whitepapers/operational-transform/operational-transform.html)
- [Socket.io Documentation](https://socket.io/docs/)

## 📄 License

MIT

---

**Built by Abiyath Rahman** | [LinkedIn](https://linkedin.com/in/abiyath-rahman-94b4662b0) | [GitHub](https://github.com/AbiyathRahman)
