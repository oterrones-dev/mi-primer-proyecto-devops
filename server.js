const express = require('express');
const path = require('path');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const client = createClient({
  url: REDIS_URL
});

client.on('error', (err) => {
  console.error('Redis error:', err);
});

async function startServer() {
  await client.connect();

  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/visits', async (req, res) => {
    const visits = await client.incr('visits');
    res.json({ visits });
  });

  app.get('/health', async (req, res) => {
    let redisStatus = 'unknown';

    try {
      await client.ping();
      redisStatus = 'ok';
    } catch (error) {
      redisStatus = 'error';
    }

    res.json({
      status: 'ok',
      redis: redisStatus
    });
  });

  app.get('/version', (req, res) => {
    res.json({
      app: 'mi-primer-proyecto-devops',
      version: '2.0.0',
      storage: 'redis'
    });
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Connected to Redis at ${REDIS_URL}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
