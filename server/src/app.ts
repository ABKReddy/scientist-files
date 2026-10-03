import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';

import { env } from './config/env';
import { apiLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import authRoutes from './routes/auth.routes';
import clueRoutes, { mediaRouter } from './routes/clue.routes';
import { storageProviderName } from './services/storage.service';

export const createApp = (): express.Express => {
  const app = express();

  // Behind a reverse proxy / load balancer (needed for correct req.ip + secure cookies).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: false, // API only — the SPA is served by Vite/nginx
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: env.clientUrl.split(',').map((origin) => origin.trim()),
      credentials: true, // httpOnly cookie auth
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  // Strips `$`-prefixed keys so NoSQL operator injection can't reach MongoDB.
  app.use(mongoSanitize());

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      service: 'scientific-files-api',
      status: 'operational',
      storage: storageProviderName(),
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/clues', clueRoutes);
  app.use('/api/media', mediaRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;