const Redis = require('ioredis');

class RedisClient {
    constructor() {
        this.publisher = null;
        this.subscriber = null;
        this.isConnected = false;
    }

    getRedisConfig() {
        // Support both REDIS_URL and REDIS_HOST/REDIS_PORT
        if (process.env.REDIS_URL) {
            return process.env.REDIS_URL;
        }

        return {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || 6379),
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        };
    }

    async connect() {
        try {
            const config = this.getRedisConfig();

            // Publisher instance
            this.publisher = new Redis(config);

            // Subscriber instance (separate connection for pub/sub)
            this.subscriber = new Redis(config);

            // Handle connection events
            this.publisher.on('connect', () => {
                console.log('Redis Publisher connected');
            });

            this.publisher.on('error', (err) => {
                console.error('Redis Publisher error:', err);
            });

            this.subscriber.on('connect', () => {
                console.log('Redis Subscriber connected');
                this.isConnected = true;
            });

            this.subscriber.on('error', (err) => {
                console.error('Redis Subscriber error:', err);
                this.isConnected = false;
            });

            return new Promise((resolve) => {
                this.subscriber.on('connect', () => {
                    resolve();
                });
            });
        } catch (err) {
            console.error('Error connecting to Redis:', err);
            throw err;
        }
    }

    async publish(channel, data) {
        if (!this.publisher) return;
        try {
            await this.publisher.publish(channel, JSON.stringify(data));
        } catch (err) {
            console.error('Error publishing to Redis:', err);
        }
    }

    async subscribe(channel, callback) {
        if (!this.subscriber) return;
        try {
            await this.subscriber.subscribe(channel);

            this.subscriber.on('message', (chan, message) => {
                if (chan === channel) {
                    try {
                        const data = JSON.parse(message);
                        callback(data);
                    } catch (err) {
                        console.error('Error parsing Redis message:', err);
                    }
                }
            });
        } catch (err) {
            console.error('Error subscribing to Redis channel:', err);
        }
    }

    async unsubscribe(channel) {
        if (!this.subscriber) return;
        try {
            await this.subscriber.unsubscribe(channel);
        } catch (err) {
            console.error('Error unsubscribing from Redis channel:', err);
        }
    }

    async disconnect() {
        try {
            if (this.publisher) await this.publisher.quit();
            if (this.subscriber) await this.subscriber.quit();
            this.isConnected = false;
            console.log('Redis connections closed');
        } catch (err) {
            console.error('Error disconnecting from Redis:', err);
        }
    }
}

// Singleton instance
let instance = null;

async function getRedisClient() {
    if (!instance) {
        instance = new RedisClient();
        await instance.connect();
    }
    return instance;
}

module.exports = { getRedisClient, RedisClient };
