import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { roomsRouter } from './routes/rooms.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

/** Build the Express app (no listening — index.js owns the HTTP server). */
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json({ limit: '16kb' }));

  // Behind one proxy hop (Heroku/Render/etc.) so req.ip / rate limits see the real IP.
  app.set('trust proxy', 1);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/rooms', roomsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
