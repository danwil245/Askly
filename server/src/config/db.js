import mongoose from 'mongoose';
import { log } from '../utils/logger.js';

mongoose.set('strictQuery', true);

/**
 * Connect to MongoDB. Returns the mongoose connection.
 * @param {string} uri
 */
export async function connectDb(uri) {
  if (!uri) throw new Error('connectDb: a MongoDB URI is required');
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });
  log.info('mongo.connected', { host: mongoose.connection.host, db: mongoose.connection.name });
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
  log.info('mongo.disconnected');
}
