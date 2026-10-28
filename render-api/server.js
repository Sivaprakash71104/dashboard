import express from 'express';
import mqtt from 'mqtt';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';

const app = express();
app.use(express.json({ limit: '2kb' }));
const here = path.dirname(fileURLToPath(import.meta.url));

const port = Number(process.env.PORT || 3000);
const mqttUrl = process.env.MQTT_URL;
const telemetryTopic = process.env.MQTT_TELEMETRY_TOPIC;
const controlTopic = process.env.MQTT_CONTROL_TOPIC;
const controlToken = process.env.CONTROL_TOKEN;
const allowedOrigin = process.env.DASHBOARD_ORIGIN || '*';
let latest = null;
let lastReceivedAt = 0;
let mqttConnected = false;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, mqttConnected }));
app.get('/', (_req, res) => res.sendFile(path.resolve(here, '../ESP32_WaterTank/dashboard.html')));
app.get('/dashboard.html', (_req, res) => res.sendFile(path.resolve(here, '../ESP32_WaterTank/dashboard.html')));
app.get('/api/state', (_req, res) => {
  const ageMs = lastReceivedAt ? Date.now() - lastReceivedAt : null;
  const fresh = ageMs !== null && ageMs < 5000;
  res.set('Cache-Control', 'no-store');
  res.json({
    bridgeOnline: mqttConnected,
    mqttConnected,
    ageMs: ageMs ?? 0xFFFFFFFF,
    telemetry: fresh ? latest : null
  });
});

app.post('/api/control', (req, res) => {
  const suppliedToken = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!controlToken) return res.status(503).json({ accepted: false, message: 'Set CONTROL_TOKEN in the Render environment' });
  const expected = Buffer.from(controlToken);
  const supplied = Buffer.from(suppliedToken);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return res.status(401).json({ accepted: false, message: 'Control token is missing or incorrect' });
  }
  const pump = req.body?.pump;
  if (pump !== 'ON' && pump !== 'OFF') {
    return res.status(400).json({ accepted: false, message: 'Expected pump ON or OFF' });
  }
  if (!mqttConnected || !controlTopic) {
    return res.status(503).json({ accepted: false, message: 'MQTT control service is offline' });
  }
  mqttClient.publish(controlTopic, JSON.stringify({ pump }), { qos: 1 }, (error) => {
    if (error) return res.status(502).json({ accepted: false, message: 'Could not send command to MQTT' });
    res.json({ accepted: true });
  });
});

let mqttClient;
if (mqttUrl && telemetryTopic && controlTopic) {
  mqttClient = mqtt.connect(mqttUrl, {
    clientId: `render-tank-${Math.random().toString(16).slice(2, 10)}`,
    reconnectPeriod: 5000,
    connectTimeout: 15000
  });
  mqttClient.on('connect', () => {
    mqttConnected = true;
    mqttClient.subscribe(telemetryTopic, { qos: 1 });
    console.log('Connected to MQTT; subscribed to telemetry topic');
  });
  mqttClient.on('reconnect', () => { mqttConnected = false; });
  mqttClient.on('close', () => { mqttConnected = false; });
  mqttClient.on('error', (error) => console.error('MQTT error:', error.message));
  mqttClient.on('message', (topic, payload) => {
    if (topic !== telemetryTopic) return;
    try {
      const data = JSON.parse(payload.toString());
      const required = ['waterLevel', 'distanceCm', 'pumpStatus', 'sourceWaterAvailable', 'systemEnabled', 'sensorFault'];
      if (!required.every((key) => Object.hasOwn(data, key))) return;
      if (!Number.isFinite(data.waterLevel) || data.waterLevel < 0 || data.waterLevel > 100 ||
          !Number.isFinite(data.distanceCm) || typeof data.pumpStatus !== 'boolean' ||
          typeof data.sourceWaterAvailable !== 'boolean' || typeof data.systemEnabled !== 'boolean' ||
          typeof data.sensorFault !== 'boolean') return;
      latest = Object.fromEntries(required.map((key) => [key, data[key]]));
      lastReceivedAt = Date.now();
    } catch { /* Ignore malformed telemetry. */ }
  });
} else {
  console.warn('MQTT is not configured. Set MQTT_URL, MQTT_TELEMETRY_TOPIC, and MQTT_CONTROL_TOPIC.');
}

const server = app.listen(port, '0.0.0.0', () => console.log(`Render API listening on ${port}`));
function shutdown() {
  server.close(() => {
    if (mqttClient) mqttClient.end(true, () => process.exit(0));
    else process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
