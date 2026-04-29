const axios = require('axios');

const API_URL = 'http://localhost:3000';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzc3NDE5MDU3LCJleHAiOjE3Nzc0MjI2NTd9.uwDoPm1-6rxUXy6K8MvCBhQUHk7h2s-rEJx_zaBiKtk';

function random(min, max) {
  return Math.random() * (max - min) + min;
}

async function sendReading(type, value) {
  try {
    await axios.post(
      `${API_URL}/api/iot/reading`,
      {
        deviceId: `${type}-sensor`,
        type,
        value
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`
        }
      }
    );

    console.log(`📡 Sent ${type}: ${value.toFixed(2)}`);
  } catch (err) {
    console.error('❌ Error sending data:', err.response?.data || err.message);
  }
}

setInterval(() => {
  sendReading('energy', random(1, 5));
  sendReading('water', random(10, 50));
  sendReading('access', Math.floor(random(1, 3)));
}, 3000);
