const path = require('path');
const fs = require('fs');

// Load .env file if it exists (for local development)
const envPath = path.join(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
}

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const dns = require('dns');
dns.setServers(['8.8.8.8']);

// Support both ATLAS_URI (cloud) and MONGODB_URI (local Docker)
const uri = process.env.MONGODB_URI || process.env.ATLAS_URI;

if (!uri) {
    console.error('⚠️  Neither MONGODB_URI nor ATLAS_URI is set!');
    console.error('   Set MONGODB_URI for local Docker: mongodb://root:example@mongodb:27017/editor_db?authSource=admin');
    console.error('   Set ATLAS_URI for MongoDB Atlas');
    process.exit(1);
}

let _db;
let _client;

module.exports = {
    connectToServer: function (callback) {
        console.log("Attempting to Connect to MongoDB...");
        console.log(`Connection URI: ${uri.split('@')[1] ? 'Using ' + uri.split('@')[1].split('/')[0] : 'local MongoDB'}`);

        const client = new MongoClient(uri, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            },
        });

        async function run() {
            try {
                await client.connect();
                await client.db("admin").command({ ping: 1 });
                console.log("✓ MongoDB connection successful");

                _db = client.db("RealTimeCollaborativeCodeEditor");
                _client = client;
                console.log("Connected to RealTimeCollaborativeCodeEditor database");
                callback();

            } catch (err) {
                console.error("MongoDB connection failed:", err);
                callback(err);
            }
        }

        run();
    },

    getDb: function () {
        return _db;
    },

    close: async function () {
        if (_client) {
            await _client.close();
            console.log("MongoDB connection closed");
        }
    }
};