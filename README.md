# AutoSnow PWA Push (iOS-compatible)

This is a minimal PWA that supports **iOS Web Push**. It also includes a small Node.js server for managing VAPID keys, storing subscriptions, and sending notifications. You can trigger pushes from **Node-RED** with a simple HTTP request.

## Features
- Works on **iOS 16.4+** when installed via **Share → Add to Home Screen**.
- HTTPS-ready (serve behind a TLS proxy or reverse proxy).
- `GET /vapidPublicKey`, `POST /subscribe`, `POST /notify` endpoints.
- Subscriptions persisted to `subscriptions.json`.
- Auto-generates VAPID keys on first run (stored in `.vapid.json`).

---

## Quick Start
1. **Install dependencies**
   ```bash
   cd autosnow-pwa-push
   npm install
   ```

2. **Run the server**
   ```bash
   npm start
   ```

3. **Expose HTTPS** (required on iPhone for push):
   - Easiest: put this behind a reverse proxy with TLS (e.g., Caddy, Nginx) **or** use Cloudflare Tunnel.
   - Make sure the site is reachable at `https://your-domain/...`

4. **On iPhone (Safari)**
   - Open `https://your-domain/`
   - Tap **Share → Add to Home Screen**
   - Open the new icon from your Home Screen
   - Tap **Enable Notifications**, then **Send Test Notification**

> If you run locally: iOS requires HTTPS, so use a tunnel (Cloudflare/Ngrok) pointing to port 3000.

---

## Triggering Push from Node-RED
You can send pushes by making an HTTP POST request to `/notify`. Example flow:

- **HTTP Request (POST)** → URL: `https://your-domain/notify`  
  **Headers:** `Content-Type: application/json`  
  **Body (JSON):**
  ```json
  {
    "title": "Pump Alert",
    "body": "Low suction pressure at Station 3",
    "url": "/#/alarms"
  }
  ```

### Node-RED Example (Function → HTTP Request)
**Function node:**
```js
msg.headers = { "Content-Type": "application/json" };
msg.payload = {
  title: "AutoSnow",
  body: "Flow meter spike detected",
  url: "/#/telemetry"
};
return msg;
```
**HTTP Request node:**
- Method: `POST`
- URL: `https://your-domain/notify`

### Option B: Use the `node-red-contrib-web-push` palette
If you prefer pure Node-RED push (without this Node server), install:
```
Manage Palette → Install → node-red-contrib-web-push
```
Then wire:
- `HTTP In  /subscribe` → `function (store sub)` → `web-push` (save VAPID keys in config)  
- `HTTP In  /notify` → `function (build payload)` → `web-push`

> The included PWA front-end will still POST to `/subscribe` and `/notify`; just serve those endpoints from Node-RED instead of this server.

---

## Environment
- To supply your own VAPID keys, create `.env` with:
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
PORT=3000
```
Otherwise, the server will generate keys and save them to `.vapid.json` on first run.

---

## Files
- `index.html` – basic UI with enable/test buttons
- `app.js` – registers service worker, subscribes to push, calls backend
- `sw.js` – handles `push` and `notificationclick`
- `manifest.webmanifest` – PWA metadata
- `server.js` – Express + web-push endpoints
- `subscriptions.json` – auto-created, stores device subscriptions
- `.vapid.json` – auto-created, stores generated VAPID keys

---

## Notes for iOS
- Must be installed via **Add to Home Screen** to request notifications.
- HTTPS is required.
- If a device stops receiving notifications, it may have an expired subscription. The server automatically prunes 404/410 responses; have users re-enable notifications in the app if needed.
