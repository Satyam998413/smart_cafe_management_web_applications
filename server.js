// Custom server (plan Phase 10 — long-running host, chosen specifically so
// Socket.IO keeps working unchanged rather than migrating every realtime
// feature to Supabase Realtime). Does NOT run through the Next.js compiler
// (confirmed in Next's own custom-server docs) — keep this file's syntax
// plain enough for the Node version actually running it.
import 'dotenv/config';
import { createServer } from 'http';
import { createServer as createNetServer } from 'net';
import next from 'next';
import { Server as SocketIoServer } from 'socket.io';
import { Aedes } from 'aedes';
import { initOrderSocket, setIo } from './src/lib/socketServer.js';
import { initMqttBroker } from './src/lib/mqttServer.js';
import { setAedes } from './src/lib/mqttPublish.js';

const port = parseInt(process.env.PORT || '3000', 10);
const mqttPort = parseInt(process.env.MQTT_PORT || '1883', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new SocketIoServer(httpServer, { cors: { origin: '*' } });
  initOrderSocket(io);
  setIo(io);

  // Embedded MQTT broker — physical devices whose transport_type is 'mqtt'
  // (see migration 0015) connect here directly, on this same long-running
  // host, instead of a third-party broker. See src/lib/mqttServer.js's own
  // header comment for why this is embedded rather than a separate service.
  // Aedes's default export is a deprecation guard (`import Aedes from
  // 'aedes'` throws at call time) — the real class is the named export.
  const aedes = new Aedes();
  initMqttBroker(aedes);
  setAedes(aedes);
  const mqttServer = createNetServer(aedes.handle);

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`> Server ready on http://localhost:${port} (${dev ? 'development' : process.env.NODE_ENV})`);
  });

  // A taken MQTT port (e.g. another broker already running on this host —
  // see .env.example's MQTT_PORT comment) must not take down the whole
  // app: HTTP/Socket.IO/'api'-transport devices all work fine without it,
  // only 'mqtt'-transport devices would be unreachable until it's freed.
  mqttServer.on('error', (error) => {
    console.error(`> MQTT broker failed to start on port ${mqttPort}: ${error.message}`);
  });

  mqttServer.listen(mqttPort, '0.0.0.0', () => {
    console.log(`> MQTT broker ready on mqtt://localhost:${mqttPort}`);
  });
});
