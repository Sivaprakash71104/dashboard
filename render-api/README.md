# Render MQTT API for the Smart Water Tank dashboard

This service serves the dashboard at `/`, receives ESP32 telemetry from an MQTT broker, and exposes `/api/state` and `/api/control`. Deploy it as a Render **Web Service** from this repository using the root `render.yaml`. The service serves `ESP32_WaterTank/dashboard.html` directly, so the browser and API share one origin.

Configure these environment variables in the Render service:

- `MQTT_URL`: broker URL reachable from Render, normally `mqtts://...:8883` or `mqtt://...:1883`.
- `MQTT_TELEMETRY_TOPIC`: the same telemetry topic configured in the ESP32 `secrets.h`.
- `MQTT_CONTROL_TOPIC`: the same control topic configured in the ESP32 `secrets.h`.
- `CONTROL_TOKEN`: a long random token required by the dashboard before sending a pump command. The browser asks for it when the user clicks a control; it is not stored in the page source.
- `DASHBOARD_ORIGIN`: set to this Web Service's `https://...onrender.com` URL; the default `*` works for a same-origin dashboard but is broader than needed.

The ESP32 must have valid Wi-Fi and MQTT settings in `ESP32_WaterTank/secrets.h`. Keep credentials out of source control. The Render web service must be able to reach the broker, and the broker must allow MQTT connections from both Render and the ESP32.

After deployment, open the Web Service's `onrender.com` URL to use the dashboard.

The API accepts `POST /api/control` with `{"pump":"ON"}` or `{"pump":"OFF"}` and a bearer token. The STM32 must continue enforcing local interlocks.
