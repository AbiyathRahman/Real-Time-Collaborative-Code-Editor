const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000;
const db = require('./db/db');
const socketHandler = require('./socket-handler');
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