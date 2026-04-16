const express = require('express');
const path = require('path');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error('Falta la variable REDIS_URL');
  process.exit(1);
}

const client = createClient({ url: REDIS_URL });

client.on('error', (err) => {
  console.error('Redis error:', err);
});

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

async function startServer() {
  await client.connect();

  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/visits', async (req, res) => {
    const ip = getClientIp(req);

    const totalVisits = await client.incr('visits:total');
    const userVisits = await client.incr(`visits:user:${ip}`);

    res.json({
      totalVisits,
      userVisits,
      ip
    });
  });

  app.get('/health', async (req, res) => {
    try {
      await client.ping();
      res.json({ status: 'ok', redis: 'ok' });
    } catch {
      res.status(500).json({ status: 'error', redis: 'down' });
    }
  });

  app.get('/version', (req, res) => {
    res.json({
      app: 'mi-primer-proyecto-devops',
      version: '3.0.0',
      storage: 'redis',
      feature: 'visitas por usuario'
    });
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
