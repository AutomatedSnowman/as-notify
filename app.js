// Client bootstrap
const statusEl = document.getElementById('status');
const swStatusEl = document.getElementById('sw-status');
const endpointEl = document.getElementById('endpoint');
const controls = document.getElementById('controls');
const note = document.getElementById('note');

const btnPermission = document.getElementById('btn-permission');
const btnTest = document.getElementById('btn-test');

async function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    statusEl.textContent = 'Service workers not supported.';
    return null;
  }
  const reg = await navigator.serviceWorker.register('/sw.js');
  swStatusEl.textContent = 'registered';
  return reg;
}

async function getPublicKey() {
  const res = await fetch('/vapidPublicKey');
  if (!res.ok) throw new Error('Failed to fetch VAPID key');
  const { publicKey } = await res.json();
  return publicKey;
}

async function subscribe(reg) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission denied');
  const publicKey = await getPublicKey();
  const appServerKey = await urlBase64ToUint8Array(publicKey);
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: appServerKey
  });
  endpointEl.textContent = sub.endpoint;
  const resp = await fetch('/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub)
  });
  if (!resp.ok) throw new Error('Failed to store subscription');
  return sub;
}

async function sendTest() {
  const resp = await fetch('/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test from server', body: 'Push delivered ✅', url: '/' })
  });
  if (!resp.ok) throw new Error('Notify failed');
}

(async () => {
  try {
    const reg = await registerSW();
    if (!reg) return;
    statusEl.innerHTML = '<span class="ok">Ready</span>';
    controls.style.display = 'block';

    btnPermission.onclick = async () => {
      try {
        await subscribe(reg);
        note.textContent = 'Subscribed. You can trigger pushes from your server/Node-RED.';
      } catch (e) {
        note.textContent = e.message;
        note.style.color = '#c22';
      }
    };
    btnTest.onclick = () => sendTest().catch(e => {
      note.textContent = e.message; note.style.color='#c22';
    });
  } catch (e) {
    statusEl.innerHTML = `<span class="err">${e.message}</span>`;
  }
})();
