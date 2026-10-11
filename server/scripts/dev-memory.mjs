// Dev convenience: start the server against an ephemeral in-memory MongoDB so you can
// run Askly without installing MongoDB. Data resets on restart. For real persistence,
// set MONGODB_URI in server/.env and use `npm run dev` instead.
import { MongoMemoryServer } from 'mongodb-memory-server';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri();
process.env.PORT = process.env.PORT || '4000';
process.env.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
// Dev-only JWT secret so the server boots without a .env (data is ephemeral anyway).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-only-in-memory-secret-change-me-please-32chars';

console.log('[dev-memory] in-memory MongoDB ready at', process.env.MONGODB_URI);

const indexPath = path.resolve(process.cwd(), 'src/index.js');
await import(pathToFileURL(indexPath).href);

const shutdown = async () => {
  await mongod.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
