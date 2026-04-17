const express = require('express');
const path = require('path');
const morgan = require('morgan');
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

  app.use(morgan('combined'));
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/visits', async (req, res) => {
    const ip = getClientIp(req);

    let totalVisits = 0;
    let userVisits = 0;

    try {
      totalVisits = await client.incr('visits:total');
      userVisits = await client.incr(`visits:user:${ip}`);
    } catch (error) {
      console.error('Redis increment error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'No se pudieron actualizar las visitas',
        ip
      });
    }

    res.json({
      totalVisits,
      userVisits,
      ip
    });
  });

  app.get('/health', async (req, res) => {
    const start = Date.now();

    try {
      await client.ping();

      res.json({
        status: 'ok',
        redis: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - start
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        redis: 'down',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get('/version', (req, res) => {
    res.json({
      app: 'mi-primer-proyecto-devops',
      version: '3.1.0',
      storage: 'redis',
      feature: 'visitas por usuario',
      logging: 'morgan'
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
