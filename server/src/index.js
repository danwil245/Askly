import http from 'node:http';
import { env, assertRequiredEnv } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';
import { attachSockets } from './sockets/index.js';
import { log } from './utils/logger.js';

async function main() {
  assertRequiredEnv();
  await connectDb(env.mongodbUri);

  const app = createApp();
  const server = http.createServer(app);
  attachSockets(server);

  server.listen(env.port, () => {
    log.info('server.listening', { port: env.port, origin: env.clientOrigin });
  });

  const shutdown = (signal) => {
    log.info('server.shutdown', { signal });
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error('server.boot.failed', { message: err?.message, stack: err?.stack });
  process.exit(1);
});
