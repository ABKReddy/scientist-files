import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectDatabase = async (): Promise<typeof mongoose> => {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connectionPromise) {
    mongoose.set('strictQuery', true);
    connectionPromise = mongoose.connect(env.mongodbUri, {
      serverSelectionTimeoutMS: 10_000,
      autoIndex: true,
    });
  }
  return connectionPromise;
};

export const disconnectDatabase = async (): Promise<void> => {
  connectionPromise = null;
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};

mongoose.connection.on('error', (err) => logger.error('MongoDB connection error', err));
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));