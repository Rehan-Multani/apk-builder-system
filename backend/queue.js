const Queue = require('bull');

// Redis configuration
const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379
};

const buildQueue = new Queue('apk-build', {
    redis: redisConfig
});

module.exports = { buildQueue };
