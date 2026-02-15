# Docker Setup Guide

Complete guide for running the Real-Time Collaborative Code Editor with Docker.

## Quick Start

### 1. Build and Start All Services

```bash
# From project root
docker-compose up -d

# Verify services are running
docker-compose ps
```

Expected output:
```
NAME                              STATUS
collaborative-editor-server-1     healthy
collaborative-editor-server-2     healthy
collaborative-editor-server-3     healthy
collaborative-editor-redis        healthy
collaborative-editor-mongodb      healthy
```

### 2. Access Services

- **Server 1**: http://localhost:3000
- **Server 2**: http://localhost:3001
- **Server 3**: http://localhost:3002
- **Redis**: localhost:6379
- **MongoDB**: localhost:27017

### 3. Start Frontend

```bash
cd frontend/vite-project
npm install
npm run dev
# Opens http://localhost:5173
```

### 4. Stop Services

```bash
docker-compose down
```

---

## Docker Architecture

```
┌─────────────────────────────────────────────────┐
│         Docker Network: editor-network          │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐
│  │  server-1    │  │  server-2    │  │ server-3 │
│  │  Port 3000   │  │  Port 3001   │  │ Port 3002│
│  │  (Node.js)   │  │  (Node.js)   │  │ (Node.js)│
│  └──────┬───────┘  └──────┬───────┘  └────┬─────┘
│         │                 │               │
│         └─────────────────┼───────────────┘
│                           │
│         ┌─────────────────┼─────────────────┐
│         │                 │                 │
│    ┌────▼────┐       ┌────▼────┐      ┌────▼────┐
│    │  Redis  │       │ MongoDB  │      │ (Other) │
│    │  6379   │       │  27017   │      │         │
│    └─────────┘       └──────────┘      └─────────┘
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## File Structure

```
.
├── Dockerfile                    ← Container definition for backend
├── .dockerignore                 ← Files to exclude from Docker build
├── docker-compose.yml            ← Multi-container orchestration
│
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── socket-handler.js
│   │   ├── redis/
│   │   │   └── client.js
│   │   └── ...
│   ├── package.json
│   └── .env.docker              ← Docker-specific env vars (optional)
│
└── frontend/
    └── vite-project/
```

---

## Configuration

### Environment Variables

Docker uses these environment variables (set in docker-compose.yml):

```yaml
environment:
  PORT: 3000                                          # Server port
  NODE_ENV: development                              # Development mode
  REDIS_HOST: redis                                  # Redis hostname (internal)
  REDIS_PORT: 6379                                   # Redis port
  MONGODB_URI: mongodb://root:example@mongodb:27017/editor_db?authSource=admin
```

### Override Variables

Create `.env.docker` in backend folder:

```env
NODE_ENV=production
APP_DEBUG=false
LOG_LEVEL=info
```

Then mount in docker-compose.yml:

```yaml
server-1:
  env_file:
    - backend/.env.docker
```

---

## Common Operations

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server-1
docker-compose logs -f redis
docker-compose logs -f mongodb

# Last 100 lines
docker-compose logs --tail=100 server-1
```

### Rebuild After Changes

```bash
# Rebuild image
docker-compose build

# Rebuild and restart
docker-compose up -d --build

# Rebuild specific service
docker-compose build server-1
docker-compose up -d server-1
```

### Execute Commands in Container

```bash
# Run command in server-1
docker exec collaborative-editor-server-1 npm test

# Access MongoDB
docker exec -it collaborative-editor-mongodb mongosh -u root -p example

# Access Redis
docker exec -it collaborative-editor-redis redis-cli

# Check server health
docker exec collaborative-editor-server-1 curl http://localhost:3000
```

### Scale Services

```bash
# Add more server instances
docker-compose up -d --scale server=5

# Note: Manually expose ports in docker-compose.yml or use load balancer
```

---

## Health Checks

Each service has automated health checks:

```bash
# Check service health
docker-compose ps

# Detailed health info
docker inspect collaborative-editor-server-1 | grep -A 10 '"Health"'
```

If unhealthy:
```bash
# View logs
docker-compose logs server-1

# Restart service
docker-compose restart server-1
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Ensure ports are available
lsof -i :3000
lsof -i :6379
lsof -i :27017

# Kill process if in use
kill -9 <PID>
```

### Redis Connection Fails

```bash
# Check Redis is running
docker-compose logs redis

# Test Redis directly
docker exec collaborative-editor-redis redis-cli ping
# Should respond: PONG

# Restart Redis
docker-compose restart redis
```

### MongoDB Connection Fails

```bash
# Check MongoDB is running
docker-compose logs mongodb

# Verify authentication
docker exec collaborative-editor-mongodb mongosh -u root -p example

# Initialize database
docker exec collaborative-editor-mongodb mongosh -u root -p example << EOF
use editor_db
db.createCollection('documents')
EOF
```

### Port Already in Use

```bash
# Specify different ports in docker-compose.yml
ports:
  - "4000:3000"  # Host:Container
  - "4001:3000"
  - "4002:3000"

# Then rebuild and restart
docker-compose up -d --build
```

### Module Not Found Error

```bash
# Rebuild with clean install
docker-compose build --no-cache server-1

# Force rebuild all
docker-compose down
docker rmi $(docker images -q collaborative-editor*)
docker-compose up -d
```

---

## Performance Tuning

### Increase Server Instances

```yaml
# docker-compose.yml
services:
  server-4:
    build: .
    ports:
      - "3003:3000"
    # ... same config as others
```

### Resource Limits

```yaml
services:
  server-1:
    # ... config
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Redis Optimization

```bash
# Check Redis memory usage
docker exec collaborative-editor-redis redis-cli INFO memory

# Set max memory policy
docker exec collaborative-editor-redis redis-cli CONFIG SET maxmemory 256mb
docker exec collaborative-editor-redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

---

## Production Deployment

### Using Docker Compose in Production

```bash
# Start in detached mode
docker-compose -f docker-compose.yml up -d

# Enable auto-restart
docker update --restart always collaborative-editor-server-1
docker update --restart always collaborative-editor-redis
docker update --restart always collaborative-editor-mongodb

# View log file
docker-compose logs server-1 > server-1.log
```

### Using Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml editor

# View services
docker service ls

# Scale service
docker service scale editor_server-1=3
```

### Using Kubernetes

Create `k8s-deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: collaborative-editor-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: editor-server
  template:
    # ... kubernetes config
```

---

## Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (delete data)
docker-compose down -v

# Remove images
docker rmi collaborative-editor-server:latest

# Clean everything (careful!)
docker system prune -a
```

---

## Network Communication

Services communicate via internal DNS:

```javascript
// From server-1 to Redis (inside Docker)
const redis = new Redis({
  host: 'redis',      // Docker service name
  port: 6379
});

// From server-1 to MongoDB (inside Docker)
const mongoUri = 'mongodb://root:example@mongodb:27017/editor_db';
```

**From outside Docker** (localhost):
```bash
# Redis
redis-cli -h localhost -p 6379

# MongoDB
mongosh mongodb://root:example@localhost:27017

# API Servers
curl http://localhost:3000
curl http://localhost:3001
curl http://localhost:3002
```

---

## Advanced Configuration

### Custom Redis Password

```yaml
# docker-compose.yml
redis:
  command: redis-server --appendonly yes --requirepass mypassword

# Update servers
environment:
  REDIS_PASSWORD: mypassword
  REDIS_URL: redis://:mypassword@redis:6379
```

### Persistent Data

All data is stored in Docker volumes:
- `redis-data` - Redis persistence
- `mongodb-data` - MongoDB database

To backup:
```bash
# Backup MongoDB
docker exec collaborative-editor-mongodb mongodump -u root -p example -o /dump

# Backup volumes
docker run --rm -v redis-data:/data -v $(pwd):/backup alpine tar czf /backup/redis-data.tar.gz -C /data .
```

---

## Monitoring

### Basic Monitoring

```bash
# Resource usage
docker stats

# Container logs
docker-compose logs -f --timestamps

# Event stream
docker events
```

### Production Monitoring Tools

- **Prometheus**: Metrics collection
- **Grafana**: Visualization dashboard
- **ELK Stack**: Log aggregation
- **Datadog**: APM monitoring
- **NewRelic**: Application performance

---

## Best Practices

✅ **Use .dockerignore** - Reduce build context  
✅ **Multi-stage builds** - Optimize final image size  
✅ **Health checks** - Verify service readiness  
✅ **Environment variables** - Don't hardcode secrets  
✅ **Volume mounts** - Persist data across restarts  
✅ **Named networks** - Better service discovery  
✅ **Resource limits** - Prevent resource exhaustion  
✅ **Update locks** - Pin dependency versions  

---

## Support

For issues:

1. Check logs: `docker-compose logs -f server-1`
2. Verify connectivity: `docker-compose ps`
3. Test service: `docker exec server-1 curl http://localhost:3000`
4. Check Redis: `docker exec redis redis-cli ping`
5. Check MongoDB: `docker exec mongodb mongosh`

