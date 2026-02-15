const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000;
const db = require('./db/db');

app.use(cors());
app.use(express.json());
const ws = require('ws');
const webSocketServer = new ws.Server({ port: 8080 });

webSocketServer.on('connection', (socket) => {
    console.log('WebSocket connection established');
});

app.listen(port, () => {
    db.connectToServer((err) => {
        if (err) {
            console.error("Failed to connect to MongoDB:", err);
            process.exit(1); // Exit the application if DB connection fails
        }

    });
    console.log(`Server is running on port ${port}`);
});