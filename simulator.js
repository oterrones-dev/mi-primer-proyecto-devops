const axios = require('axios');

const TARGETS = [
  {
    name: 'local',
    url: process.env.IOT_TARGET_URL || 'http://localhost:3000'
  }
];

const USERNAME = process.env.APP_USER;
const PASSWORD = process.env.APP_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error('Missing APP_USER or APP_PASSWORD');
  process.exit(1);
}

const tokens = {};

function random(min, max) {
  return Math.random() * (max - min) + min;
}

async function login(target) {
  const res = await axios.post(`${target.url}/login`, {
    username: USERNAME,
    password: PASSWORD
  });

  tokens[target.name] = res.data.token;
  console.log(`🔐 Token obtenido para ${target.name}`);
}

async function sendReading(target, type, value, unit) {
  try {
    if (!tokens[target.name]) {
      await login(target);
    }

    const payload = {
      deviceId: `${target.name}-${type}-sensor-01`,
      type,
      value,
      unit
    };

    await axios.post(`${target.url}/api/iot/reading`, payload, {
      headers: {
        Authorization: `Bearer ${tokens[target.name]}`
      }
    });

    console.log(`📡 ${target.name} → ${type}: ${value.toFixed(2)} ${unit || ''}`);
  } catch (err) {
    const status = err.response?.status;

    console.error(
      `❌ ${target.name} error:`,
      err.response?.data || err.message
    );

    if (status === 401 || status === 403) {
      tokens[target.name] = null;
      await login(target);
    }
  }
}

async function tick() {
  const readings = [
    ['energy', Number(random(1, 5).toFixed(2)), 'kWh'],
    ['water', Number(random(10, 50).toFixed(2)), 'liters'],
    ['access', Math.floor(random(1, 3)), 'event']
  ];

  for (const target of TARGETS) {
    for (const [type, value, unit] of readings) {
      await sendReading(target, type, value, unit);
    }
  }
}

async function start() {
  console.log('🚀 IoT simulator running: local only');

  for (const target of TARGETS) {
    await login(target);
  }

  await tick();
  setInterval(tick, 3000);
}

start().catch((err) => {
  console.error('💥 Simulator failed:', err.response?.data || err.message);
  process.exit(1);
});