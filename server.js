// Custom server (plan Phase 10 — long-running host, chosen specifically so
// Socket.IO keeps working unchanged rather than migrating every realtime
// feature to Supabase Realtime). Does NOT run through the Next.js compiler
// (confirmed in Next's own custom-server docs) — keep this file's syntax
// plain enough for the Node version actually running it.
import 'dotenv/config';
import { createServer } from 'http';
import next from 'next';
import { Server as SocketIoServer } from 'socket.io';
import { initOrderSocket, setIo } from './src/lib/socketServer.js';

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new SocketIoServer(httpServer, { cors: { origin: '*' } });
  initOrderSocket(io);
  setIo(io);

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`> Server ready on http://localhost:${port} (${dev ? 'development' : process.env.NODE_ENV})`);
  });
});
