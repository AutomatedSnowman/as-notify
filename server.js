// Minimal Express + web-push server
// Usage: npm i express web-push cors dotenv body-parser
//        node server.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const webpush = require('web-push');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Static files (serve the PWA)
app.use(express.static(path.join(__dirname)));

// Load/generate VAPID keys
const vapidPath = path.join(__dirname, '.vapid.json');
let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  if (fs.existsSync(vapidPath)) {
    const saved = JSON.parse(fs.readFileSync(vapidPath, 'utf8'));
    VAPID_PUBLIC_KEY = saved.publicKey;
    VAPID_PRIVATE_KEY = saved.privateKey;
  } else {
    const keys = webpush.generateVAPIDKeys();
    VAPID_PUBLIC_KEY = keys.publicKey;
    VAPID_PRIVATE_KEY = keys.privateKey;
    fs.writeFileSync(vapidPath, JSON.stringify(keys, null, 2));
    console.log('Generated VAPID keys and saved to .vapid.json');
  }
}

webpush.setVapidDetails(
  'mailto:admin@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Persist subscriptions
const subsPath = path.join(__dirname, 'subscriptions.json');
let subscriptions = [];
if (fs.existsSync(subsPath)) {
  try { subscriptions = JSON.parse(fs.readFileSync(subsPath, 'utf8')); } catch (e) { subscriptions = []; }
}

function saveSubs() { fs.writeFileSync(subsPath, JSON.stringify(subscriptions, null, 2)); }

app.get('/vapidPublicKey', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  const exists = subscriptions.find(s => s.endpoint === sub.endpoint);
  if (!exists) subscriptions.push(sub);
  saveSubs();
  res.json({ ok: true });
});

app.post('/notify', async (req, res) => {
  const payload = JSON.stringify({
    title: req.body.title || 'AutoSnow',
    body: req.body.body || 'Notification',
    url: req.body.url || '/'
  });
  const results = [];
  const stillValid = [];
  for (const sub of subscriptions) {
    try {
      const r = await webpush.sendNotification(sub, payload);
      results.push({ endpoint: sub.endpoint, statusCode: r.statusCode || 201 });
      stillValid.push(sub);
    } catch (e) {
      results.push({ endpoint: sub.endpoint, error: e.statusCode || e.message });
      // 404/410 => remove stale subscription
      if (e.statusCode !== 404 && e.statusCode !== 410) stillValid.push(sub);
    }
  }
  subscriptions = stillValid;
  saveSubs();
  res.json({ sent: results.length, results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PWA push server running on :${PORT}`));
