# Docker Quick Reference

Fast commands for common Docker operations.

## Start/Stop

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d server-1

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart server-1
```

## Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server-1
docker-compose logs -f redis
docker-compose logs -f mongodb

# Last 50 lines
docker-compose logs --tail=50 server-1

# With timestamps
docker-compose logs -f --timestamps server-1
```

## Status

```bash
# Services status
docker-compose ps

# Detailed info
docker-compose ps -a

# Resource usage
docker stats

# Container health
docker-compose ps | grep healthy
```

## Build

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build server-1

# Build without cache
docker-compose build --no-cache

# Build and restart
docker-compose up -d --build
```

## Execute Commands

```bash
# Run command in container
docker exec collaborative-editor-server-1 curl http://localhost:3000

# Interactive shell
docker exec -it collaborative-editor-server-1 /bin/sh

# Check Node version
docker exec collaborative-editor-server-1 node --version

# View files
docker exec collaborative-editor-server-1 ls -la /app
```

## Redis Operations

```bash
# Connect to Redis CLI
docker exec -it collaborative-editor-redis redis-cli

# Ping redis
docker exec collaborative-editor-redis redis-cli ping

# Check memory
docker exec collaborative-editor-redis redis-cli INFO memory

# Check channels
docker exec collaborative-editor-redis redis-cli PUBSUB CHANNELS

# Subscribe to channel
docker exec -it collaborative-editor-redis redis-cli SUBSCRIBE 'room:*:operations'

# Flush database
docker exec collaborative-editor-redis redis-cli FLUSHALL
```

## MongoDB Operations

```bash
# Connect to MongoDB
docker exec -it collaborative-editor-mongodb mongosh -u root -p example

# Check databases
docker exec collaborative-editor-mongodb mongosh -u root -p example --eval "show dbs"

# Backup
docker exec collaborative-editor-mongodb mongodump -u root -p example -o /dump

# Restore
docker exec collaborative-editor-mongodb mongorestore -u root -p example /dump
```

## Images & Cleanup

```bash
# List images
docker images

# List running containers
docker ps

# List all containers
docker ps -a

# Remove image
docker rmi collaborative-editor-server:latest

# Remove unused images
docker image prune

# Remove unused containers
docker container prune

# Remove everything (careful!)
docker system prune -a
```

## Networking

```bash
# List networks
docker network ls

# Inspect network
docker network inspect editor-network

# Test connectivity from container
docker exec server-1 ping redis

# Check DNS resolution
docker exec server-1 nslookup redis
```

## Troubleshooting

```bash
# View full logs
docker-compose logs server-1 --no-limit

# Follow logs with timestamps
docker-compose logs -f --timestamps

# Get exit code
docker-compose ps server-1

# Inspect container
docker inspect collaborative-editor-server-1

# Check resource limits
docker stats --no-stream

# Kill container (force stop)
docker kill collaborative-editor-server-1

# Remove stuck container
docker rm -f collaborative-editor-server-1
```

## One-Liners

```bash
# Rebuild everything and restart
docker-compose down && docker-compose build --no-cache && docker-compose up -d

# View latest logs and follow
docker-compose logs -f --tail=100

# Check all service health
docker-compose ps | grep -E "healthy|unhealthy"

# Stop all editor containers
docker stop $(docker ps -q --filter "name=collaborative-editor")

# Remove all editor images
docker rmi $(docker images | grep collaborative-editor | awk '{print $3}')

# Get Redis memory stats
docker exec collaborative-editor-redis redis-cli INFO memory | grep used_memory_human

# Restart unhealthy service
docker-compose ps | grep -i unhealthy | awk '{print $1}' | xargs -I {} docker-compose restart {}
```

## Monitoring

```bash
# Real-time resource usage
docker stats

# Watch for changes
docker stats --no-stream && sleep 5 && docker stats --no-stream

# Check service depends_on completion
docker-compose logs | grep -i "healthy\|error\|fail"

# Monitor specific service
docker logs -f collaborative-editor-server-1 | grep -i "operation\|error"

# Redis activity
docker exec -it collaborative-editor-redis redis-cli MONITOR
```

## Scale Services

```bash
# (Requires ports setup - see docker-compose.yml)

# Add more instances
docker-compose up -d --scale server=5

# Note: Manual port mapping needed for multiple instances
# Each needs unique host port → 3000 container port
```

## Development

```bash
# Rebuild on code changes
docker-compose up -d --build

# View build process
docker-compose build --progress=plain

# Interactive debugging
docker exec -it collaborative-editor-server-1 node --inspect-brk src/server.js

# Check file permissions
docker exec collaborative-editor-server-1 ls -la /app/src
```

## Production

```bash
# Enable auto-restart on system reboot
docker update --restart always collaborative-editor-server-1
docker update --restart always collaborative-editor-redis
docker update --restart always collaborative-editor-mongodb

# Export logs
docker-compose logs > backup.log

# Configuration backup
docker-compose config > docker-compose-backup.yml

# Cold migration (stop, backup, restore)
docker-compose stop
docker volume ls | grep editor | xargs -I {} docker volume inspect {}
```

## Environment Variables

```bash
# Set variable in docker-compose.yml
environment:
  PORT: 3000
  NODE_ENV: production

# Or from .env file
env_file:
  - .env.docker

# Override at runtime
docker-compose run -e PORT=4000 server-1
```

## Common Issues

```bash
# Port already in use → Check what's listening
lsof -i :3000

# Container won't start → Check logs
docker-compose logs server-1 --no-limit

# MongoDB auth failure → Reset MongoDB
docker-compose stop mongodb
docker volume rm collaborative-editor_mongodb-data
docker-compose up -d mongodb

# Redis connection error → Verify Redis is running
docker exec collaborative-editor-redis redis-cli ping
# Should respond: PONG

# Out of disk space → Cleanup
docker system prune -a --volumes
```

## Useful Aliases (Add to .bashrc or .zshrc)

```bash
alias dcu='docker-compose up -d'
alias dcd='docker-compose down'
alias dcl='docker-compose logs -f'
alias dcp='docker-compose ps'
alias dcb='docker-compose build'
alias dcr='docker-compose restart'

# Usage:
dcu      # Start all
dcl      # Follow logs
dcp      # Check status
```
