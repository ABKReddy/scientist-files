import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import { logger } from './utils/logger';
import { storageProviderName } from './services/storage.service';

const start = async (): Promise<void> => {
  try {
    await connectDatabase();
    logger.info('Connected to MongoDB');

    const app = createApp();
    const server = app.listen(env.port, () => {
      logger.info(`SCIENTIFIC FILES API listening on http://localhost:${env.port}`);
      logger.info(`Environment: ${env.nodeEnv} | Video storage: ${storageProviderName()}`);
      logger.info(`CORS origin: ${env.clientUrl}`);
    });

    const shutdown = (signal: string) => {
      logger.warn(`${signal} received — shutting down`);
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled promise rejection', reason);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

void start();