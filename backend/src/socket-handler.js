const { ObjectId } = require("mongodb");
const db = require('./db/db');

const rooms = new Map();

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
                    rooms.set(roomId, new Set());
                }

                // Add user to room
                rooms.get(roomId).add({
                    socketId: socket.id,
                    userId,
                    username,
                    color: socket.userColor
                });

                // Get or create document
                let doc = await getDocument(roomId);
                if (!doc) {
                    doc = await createDocument({
                        roomId,
                        content: '',
                        createdBy: userId,
                        version: 0
                    });
                }

                // Send document to joining user
                socket.emit('document-loaded', { 
                    content: doc.content, 
                    version: doc.version 
                });

                // Notify all users in room about new user joining
                io.to(roomId).emit('user-joined', {
                    users: Array.from(rooms.get(roomId))
                });

                console.log(`User ${username} joined room ${roomId}`);

            } catch (err) {
                console.error("Error joining room:", err);
                socket.emit('error', 'Failed to join room');
            }
        });

        socket.on('edit', async (data) => {
            const { content, version } = data;
            const roomId = socket.roomId;

            if (!roomId) return;

            try {
                // Update document in DB
                await updateDocument(roomId, content, version);

                // Broadcast changes to all users in the room except sender
                socket.to(roomId).emit('content-changed', {
                    content,
                    version,
                    userId: socket.userId,
                    userColor: socket.userColor
                });

            } catch (err) {
                console.error("Error updating document:", err);
            }
        });

        socket.on('disconnect', () => {
            const roomId = socket.roomId;
            const userId = socket.userId;
            const username = socket.username;

            if (roomId && rooms.has(roomId)) {
                const room = rooms.get(roomId);
                room.forEach(user => {
                    if (user.socketId === socket.id) {
                        room.delete(user);
                    }
                });

                if (room.size === 0) {
                    rooms.delete(roomId);
                } else {
                    // Notify remaining users
                    io.to(roomId).emit('user-left', {
                        userId,
                        username,
                        users: Array.from(room)
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