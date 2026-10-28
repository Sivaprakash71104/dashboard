# Smart Water Tank dashboard

This repository serves the live dashboard from a Render Web Service and bridges it to MQTT telemetry and pump commands. The dashboard is at `/`; the service API is at `/api/state` and `/api/control`.

## Deploy on Render

Use the root `render.yaml` as a Render Blueprint, or configure a Node Web Service with:

- Build command: `npm install --prefix render-api`
- Start command: `node render-api/server.js`
- Health check path: `/health`

Set these values in the Render service's private Environment settings:

- `MQTT_URL`: broker URL, for example `mqtt://user:password@broker.example.com:1883`.
- `MQTT_TELEMETRY_TOPIC`: topic published by the ESP32.
- `MQTT_CONTROL_TOPIC`: topic subscribed to by the ESP32.
- `CONTROL_TOKEN`: private token requested by the dashboard when a pump button is clicked.
- `DASHBOARD_ORIGIN`: this service's `https://...onrender.com` URL.

Do not put Wi-Fi, MQTT, or control credentials in this public repository. The ESP32 must use the same broker and topics in its local, untracked `secrets.h`. The current ESP32 firmware uses plain MQTT over TCP (typically port 1883); a TLS-only broker requires a firmware update.

Remote `ON` commands are also subject to STM32-side safety interlocks. Keep the physical controls and interlocks working independently of this dashboard.
