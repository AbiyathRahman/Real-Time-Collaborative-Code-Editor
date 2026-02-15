const { ObjectId } = require("mongodb");
const db = require('./db/db');
const apply = require('./ot/apply');
const transform = require('./ot/transform');
const { createInsertOperation, createDeleteOperation, isValidOperation } = require('./ot/operations');
const { getRedisClient } = require('./redis/client');

const rooms = new Map(); // Structure: { roomId -> { document, pendingOps: [], cursors: Map<socketId, cursor> } }
let redisClient = null;

function getUserColor(userId) {
    const colors = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6'];
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
}

async function getDocument(roomId) {
    try {
        const database = db.getDb();
        const documents = database.collection('documents');
        let doc = await documents.findOne({ roomId });
        return doc;
    } catch (err) {
        console.error("Error getting document:", err);
        return null;
    }
}

async function createDocument(docData) {
    try {
        const database = db.getDb();
        const documents = database.collection('documents');
        const result = await documents.insertOne({
            ...docData,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        return { _id: result.insertedId, ...docData };
    } catch (err) {
        console.error("Error creating document:", err);
        return null;
    }
}

async function updateDocument(roomId, content, version) {
    try {
        const database = db.getDb();
        const documents = database.collection('documents');
        const result = await documents.updateOne(
            { roomId },
            {
                $set: {
                    content,
                    version,
                    updatedAt: new Date()
                }
            }
        );
        return result.modifiedCount > 0;
    } catch (err) {
        console.error("Error updating document:", err);
        return false;
    }
}

function handleSocket(io) {
    // Initialize Redis client
    getRedisClient().then(client => {
        redisClient = client;
    }).catch(err => {
        console.error('Failed to initialize Redis client:', err);
    });

    io.on('connection', (socket) => {
        console.log('Socket.IO connection established:', socket.id);

        socket.on('join-room', async (data) => {
            const { roomId, userId, username } = data;
            try {
                socket.join(roomId);
                socket.roomId = roomId;
                socket.userId = userId;
                socket.username = username;
                socket.userColor = getUserColor(userId);

                // Initialize room if it doesn't exist
                if (!rooms.has(roomId)) {
                    const doc = await getDocument(roomId);
                    if (!doc) {
                        await createDocument({
                            roomId,
                            content: '',
                            createdBy: userId,
                            version: 0
                        });
                    }
                    rooms.set(roomId, {
                        document: doc || { content: '', version: 0 },
                        pendingOps: [],
                        cursors: new Map()
                    });

                    // Subscribe to Redis channel for this room
                    if (redisClient) {
                        const redisChannelName = `room:${roomId}:operations`;
                        redisClient.subscribe(redisChannelName, (data) => {
                            console.log(`Received operation from Redis for room ${roomId}:`, data);
                            // Broadcast to all local Socket.IO clients in this room
                            // Exclude the user who sent it (if on this server)
                            io.to(roomId).emit('content-changed', {
                                operation: data.operation,
                                userId: data.userId,
                                username: data.username,
                                userColor: data.userColor,
                                version: data.version
                            });
                        }).catch(err => {
                            console.error(`Failed to subscribe to Redis channel ${redisChannelName}:`, err);
                        });
                    }
                }

                const roomData = rooms.get(roomId);

                // Get current document from DB
                const doc = await getDocument(roomId);

                // Send document to joining user
                socket.emit('document-loaded', {
                    content: doc.content,
                    version: doc.version
                });

                // Notify all users in room about new user joining
                const users = Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(socketId => {
                    const s = io.sockets.sockets.get(socketId);
                    return {
                        socketId: s.id,
                        userId: s.userId,
                        username: s.username,
                        color: s.userColor
                    };
                });

                io.to(roomId).emit('user-joined', {
                    userId,
                    username,
                    users
                });
                console.log(`User ${username} joined room ${roomId}`);

            } catch (err) {
                console.error("Error joining room:", err);
                socket.emit('error', 'Failed to join room');
            }
        });

        socket.on('cursor-move', (data) => {
            const { line, column } = data;
            const roomId = socket.roomId;

            if (!roomId || !rooms.has(roomId)) return;

            try {
                const roomData = rooms.get(roomId);

                // Store cursor position
                roomData.cursors.set(socket.id, {
                    socketId: socket.id,
                    userId: socket.userId,
                    username: socket.username,
                    color: socket.userColor,
                    line,
                    column
                });

                // Broadcast cursor to all other users in room
                socket.to(roomId).emit('remote-cursor', {
                    socketId: socket.id,
                    userId: socket.userId,
                    username: socket.username,
                    color: socket.userColor,
                    line,
                    column
                });

            } catch (err) {
                console.error("Error tracking cursor:", err);
            }
        });

        socket.on('edit', async (data) => {
            const { operation } = data;
            const roomId = socket.roomId;

            if (!roomId || !rooms.has(roomId)) return;

            try {
                // Validate operation
                if (!isValidOperation(operation)) {
                    console.error('Invalid operation:', operation);
                    return;
                }

                const roomData = rooms.get(roomId);
                const currentDoc = await getDocument(roomId);
                let transformedOp = operation;

                // Transform against pending operations from other users
                for (let pendingOp of roomData.pendingOps) {
                    transformedOp = transform(pendingOp, transformedOp);
                    console.log(transformedOp);
                }
                console.log(transformedOp);

                // Apply the transformed operation to document
                const newContent = apply(currentDoc.content, transformedOp);
                const newVersion = currentDoc.version + 1;

                // Update document in DB
                await updateDocument(roomId, newContent, newVersion);

                // Update room state
                roomData.document = { content: newContent, version: newVersion };

                // Broadcast transformed operation to all users except sender
                socket.to(roomId).emit('content-changed', {
                    operation: transformedOp,
                    userId: socket.userId,
                    username: socket.username,
                    userColor: socket.userColor,
                    version: newVersion
                });

                // Publish to Redis so other servers can broadcast to their clients
                if (redisClient) {
                    const redisChannelName = `room:${roomId}:operations`;
                    await redisClient.publish(redisChannelName, {
                        operation: transformedOp,
                        userId: socket.userId,
                        username: socket.username,
                        userColor: socket.userColor,
                        version: newVersion
                    });
                    console.log(`Published operation to Redis channel ${redisChannelName}`);
                }

                // Clear pending operations since all clients will now have this state
                roomData.pendingOps = [];

                console.log(`Operation applied in room ${roomId}:`, transformedOp);

            } catch (err) {
                console.error("Error processing edit:", err);
                socket.emit('error', 'Failed to process edit');
            }
        });

        socket.on('disconnect', () => {
            const roomId = socket.roomId;
            const userId = socket.userId;
            const username = socket.username;

            if (roomId && rooms.has(roomId)) {
                const roomData = rooms.get(roomId);

                // Remove cursor position
                roomData.cursors.delete(socket.id);

                const users = Array.from(io.sockets.adapter.rooms.get(roomId) || [])
                    .filter(socketId => socketId !== socket.id)
                    .map(socketId => {
                        const s = io.sockets.sockets.get(socketId);
                        return {
                            socketId: s.id,
                            userId: s.userId,
                            username: s.username,
                            color: s.userColor
                        };
                    });

                if (users.length === 0) {
                    rooms.delete(roomId);

                    // Unsubscribe from Redis channel when room is empty
                    if (redisClient) {
                        const redisChannelName = `room:${roomId}:operations`;
                        redisClient.unsubscribe(redisChannelName).catch(err => {
                            console.error(`Failed to unsubscribe from Redis channel ${redisChannelName}:`, err);
                        });
                    }
                } else {
                    // Notify cursor removal
                    io.to(roomId).emit('cursor-removed', { socketId: socket.id });

                    io.to(roomId).emit('user-left', {
                        userId,
                        username,
                        users
                    });
                }
            }

            console.log(`User ${username} (${socket.id}) disconnected from room ${roomId}`);
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    });
}

module.exports = handleSocket;