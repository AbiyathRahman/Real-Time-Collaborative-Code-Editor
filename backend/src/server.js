const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000;
const db = require('./db/db');
const socketHandler = require('./socket-handler');
const { getRedisClient } = require('./redis/client');
const { Server } = require('socket.io');
const http = require('http');

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

socketHandler(io);

server.listen(port, () => {
    db.connectToServer((err) => {
        if (err) {
            console.error("Failed to connect to MongoDB:", err);
            process.exit(1);
        }
    });
    console.log(`Server is running on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(async () => {
        console.log('HTTP server closed');

        // Disconnect Redis
        try {
            const redisClient = await getRedisClient();
            await redisClient.disconnect();
        } catch (err) {
            console.error('Error closing Redis connection:', err);
        }

        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(async () => {
        console.log('HTTP server closed');

        // Disconnect Redis
        try {
            const redisClient = await getRedisClient();
            await redisClient.disconnect();
        } catch (err) {
            console.error('Error closing Redis connection:', err);
        }

        process.exit(0);
    });
});