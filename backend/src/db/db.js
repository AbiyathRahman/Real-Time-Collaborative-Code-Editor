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

const uri = process.env.ATLAS_URI;
let _db;
let _client;

module.exports = {
    connectToServer: function (callback) {
        console.log("Attempting to Connect to MongoDB...");

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