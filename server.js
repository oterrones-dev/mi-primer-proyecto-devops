const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const COUNTER_FILE = path.join(__dirname, 'counter.txt');

let visits = 0;

// Cargar contador existente si ya existe el archivo
if (fs.existsSync(COUNTER_FILE)) {
  const saved = fs.readFileSync(COUNTER_FILE, 'utf8');
  visits = parseInt(saved, 10) || 0;
}

// Servir frontend desde /public
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint del contador
app.get('/api/visits', (req, res) => {
  visits += 1;
  fs.writeFileSync(COUNTER_FILE, String(visits));
  res.json({ visits });
});

// Endpoint health
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
