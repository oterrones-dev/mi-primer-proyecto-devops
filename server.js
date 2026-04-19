require('dotenv').config();

const express = require('express');
const path = require('path');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL;

const metrics = {
  totalRequests: 0,
  totalErrors: 0,
  loginSuccess: 0,
  loginFailures: 0,
  startTime: Date.now()
};

if (!REDIS_URL) {
  console.error('Falta la variable REDIS_URL');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('Falta la variable JWT_SECRET');
  process.exit(1);
}

if (!process.env.APP_USER || !process.env.APP_PASSWORD_HASH) {
  console.error('Faltan APP_USER o APP_PASSWORD_HASH');
  process.exit(1);
}

const client = createClient({ url: REDIS_URL });

client.on('error', (err) => {
  console.error('Redis error:', err);
});

app.use(express.json());
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  metrics.totalRequests++;

  res.on('finish', () => {
    if (res.statusCode >= 400) {
      metrics.totalErrors++;
    }
  });

  next();
});

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
}

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      metrics.loginFailures++;
      return res.status(400).json({ error: 'Faltan credenciales' });
    }

    const validUser = username === process.env.APP_USER;
    const validPassword = await bcrypt.compare(
      password,
      process.env.APP_PASSWORD_HASH
    );

    if (!validUser || !validPassword) {
      metrics.loginFailures++;
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      {
        username,
        role: 'admin'
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1h'
      }
    );

    metrics.loginSuccess++;

    res.json({
      message: 'Login exitoso',
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    metrics.loginFailures++;
    res.status(500).json({ error: 'Error interno en login' });
  }
});

app.get('/api/visits', authenticateToken, async (req, res) => {
  const ip = getClientIp(req);

  let totalVisits = 0;
  let userVisits = 0;

  try {
    totalVisits = await client.incr('visits:total');
    userVisits = await client.incr(`visits:user:${req.user.username}`);
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
    ip,
    user: req.user.username
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

app.get('/metrics', authenticateToken, (req, res) => {
  res.json({
    uptimeSeconds: Math.floor((Date.now() - metrics.startTime) / 1000),
    totalRequests: metrics.totalRequests,
    totalErrors: metrics.totalErrors,
    loginSuccess: metrics.loginSuccess,
    loginFailures: metrics.loginFailures,
    successRate:
      metrics.totalRequests > 0
        ? (
            (metrics.totalRequests - metrics.totalErrors) /
            metrics.totalRequests
          ).toFixed(4)
        : '1.0000'
  });
});

app.get('/metrics-prom', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - metrics.startTime) / 1000);
  const successRate =
    metrics.totalRequests > 0
      ? (metrics.totalRequests - metrics.totalErrors) / metrics.totalRequests
      : 1;

  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.totalRequests}

# HELP http_errors_total Total HTTP errors
# TYPE http_errors_total counter
http_errors_total ${metrics.totalErrors}

# HELP app_uptime_seconds Application uptime in seconds
# TYPE app_uptime_seconds gauge
app_uptime_seconds ${uptimeSeconds}

# HELP app_success_rate Success rate of requests
# TYPE app_success_rate gauge
app_success_rate ${successRate}

# HELP auth_login_success_total Successful logins
# TYPE auth_login_success_total counter
auth_login_success_total ${metrics.loginSuccess}

# HELP auth_login_failures_total Failed logins
# TYPE auth_login_failures_total counter
auth_login_failures_total ${metrics.loginFailures}
`.trim() + '\n');
});

app.get('/version', authenticateToken, (req, res) => {
  res.json({
    app: 'mi-primer-proyecto-devops',
    version: '4.0.0',
    storage: 'redis',
    feature: 'visitas por usuario con JWT',
    logging: 'morgan',
    metrics: 'enabled'
  });
});

async function startServer() {
  await client.connect();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
