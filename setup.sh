#!/bin/bash

# Multi-Server Real-Time Collaborative Code Editor - Setup Script

echo "=========================================="
echo "Real-Time Code Editor - Multi-Server Setup"
echo "=========================================="
echo ""

# Check dependencies
echo "Checking dependencies..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    echo "   Install from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "   Install from: https://nodejs.org/"
    exit 1
fi

echo "✅ Docker found: $(docker --version)"
echo "✅ Node.js found: $(node --version)"
echo ""

# Start Docker services
echo "Starting Redis and MongoDB with Docker Compose..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ Failed to start Docker containers"
    exit 1
fi

echo "✅ Docker containers started"
sleep 2

# Wait for services to be ready
echo "Waiting for services to be ready..."
for i in {1..30}; do
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is ready"
        break
    fi
    echo "  Waiting for Redis... ($i/30)"
    sleep 1
done

echo ""
echo "=========================================="
echo "Setup Complete! 🎉"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Backend Setup:"
echo "   cd backend"
echo "   npm install"
echo "   npm start"
echo ""
echo "2. Frontend Setup (new terminal):"
echo "   cd frontend/vite-project"
echo "   npm install"
echo "   npm run dev"
echo ""
echo "3. Run Multiple Servers (optional):"
echo "   Terminal 1: PORT=3000 npm start"
echo "   Terminal 2: PORT=3001 npm start"
echo "   Terminal 3: PORT=3002 npm start"
echo ""
echo "Services:"
echo "  - Redis: localhost:6379"
echo "  - MongoDB: localhost:27017"
echo "  - Frontend: http://localhost:5173"
echo "  - Server 1: http://localhost:3000"
echo ""
echo "To stop services:"
echo "  docker-compose down"
echo ""
