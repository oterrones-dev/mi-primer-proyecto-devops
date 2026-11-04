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
      { username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    metrics.loginSuccess++;

    res.json({ message: 'Login exitoso', token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error interno en login' });
  }
});


// 🔥 ENDPOINT IoT (CORREGIDO - SOLO ESTE)
app.post('/api/iot/reading', authenticateToken, async (req, res) => {
  try {
    const { deviceId, type, value } = req.body;

    if (!deviceId || !type || typeof value !== 'number') {
      return res.status(400).json({
        status: 'error',
        message: 'deviceId, type and numeric value are required'
      });
    }

    const allowedTypes = ['energy', 'water', 'access'];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        status: 'error',
        message: 'type must be one of: energy, water, access'
      });
    }

    // 🔥 Guardar en Redis
    if (type === 'energy') {
      await client.incrByFloat('iot:energyKwhTotal', value);
    }

    if (type === 'water') {
      await client.incrByFloat('iot:waterLitersTotal', value);
    }

    if (type === 'access') {
      await client.incrBy('iot:accessEventsTotal', value);
    }

    const reading = {
      deviceId,
      type,
      value,
      timestamp: new Date().toISOString()
    };

    await client.set('iot:lastReading', JSON.stringify(reading));

    res.json({
      status: 'ok',
      reading
    });

  } catch (error) {
    console.error('IoT error:', error);
    res.status(500).json({ error: 'Error procesando lectura IoT' });
  }
});


// 🔥 METRICS (ahora desde Redis)
app.get('/metrics', authenticateToken, async (req, res) => {
  const energy = Number(await client.get('iot:energyKwhTotal') || 0);
  const water = Number(await client.get('iot:waterLitersTotal') || 0);
  const access = Number(await client.get('iot:accessEventsTotal') || 0);

  res.json({
    uptimeSeconds: Math.floor((Date.now() - metrics.startTime) / 1000),
    totalRequests: metrics.totalRequests,
    totalErrors: metrics.totalErrors,
    loginSuccess: metrics.loginSuccess,
    loginFailures: metrics.loginFailures,
    iot: {
      energyKwhTotal: energy,
      waterLitersTotal: water,
      accessEventsTotal: access
    }
  });
});


// 🔥 PROMETHEUS (desde Redis)
app.get('/metrics-prom', async (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - metrics.startTime) / 1000);

  const energy = Number(await client.get('iot:energyKwhTotal') || 0);
  const water = Number(await client.get('iot:waterLitersTotal') || 0);
  const access = Number(await client.get('iot:accessEventsTotal') || 0);

  res.set('Content-Type', 'text/plain');

  res.send(`
# HELP iot_energy_kwh_total Total energy consumption
# TYPE iot_energy_kwh_total counter
iot_energy_kwh_total ${energy}

# HELP iot_water_liters_total Total water usage
# TYPE iot_water_liters_total counter
iot_water_liters_total ${water}

# HELP iot_access_events_total Total access events
# TYPE iot_access_events_total counter
iot_access_events_total ${access}

# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.totalRequests}

# HELP http_errors_total Total HTTP errors
# TYPE http_errors_total counter
http_errors_total ${metrics.totalErrors}

# HELP app_uptime_seconds Application uptime
# TYPE app_uptime_seconds gauge
app_uptime_seconds ${uptimeSeconds}
`.trim() + '\n');
});

app.get('/health', async (req, res) => {
  try {
    await client.ping();

    res.json({
      status: 'ok',
      redis: 'ok'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      redis: 'down'
    });
  }
});

async function startServer() {
  await client.connect();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();