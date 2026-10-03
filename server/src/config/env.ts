import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const bool = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

/** Fails fast in production, falls back to safe dev defaults locally. */
const requiredInProduction = (name: string, value: string | undefined, devFallback: string): string => {
  if (value && value.trim() && !value.includes('replace-me')) return value.trim();
  if (isProduction) {
    throw new Error(
      `[config] Missing required environment variable "${name}". Copy server/.env.example to server/.env and set it.`
    );
  }
  return devFallback;
};

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const cloudApiKey = process.env.CLOUDINARY_API_KEY?.trim();
const cloudApiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
const hasCloudinaryConfig = Boolean(cloudName && cloudApiKey && cloudApiSecret);

const storageProvider = (
  process.env.STORAGE_PROVIDER?.trim().toLowerCase() || (hasCloudinaryConfig ? 'cloudinary' : 'local')
) as 'cloudinary' | 'local';

if (storageProvider === 'cloudinary' && !hasCloudinaryConfig) {
  if (isProduction) {
    throw new Error(
      '[config] STORAGE_PROVIDER=cloudinary requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.'
    );
  }
  console.warn(
    '[config] Cloudinary credentials missing — falling back to STORAGE_PROVIDER=local (files stored in server/uploads).'
  );
}

const resolvedProvider = storageProvider === 'cloudinary' && hasCloudinaryConfig ? 'cloudinary' : 'local';

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  port: int(process.env.PORT, 5000),
  clientUrl: process.env.CLIENT_URL?.trim() || 'http://localhost:5173',
  mongodbUri: requiredInProduction(
    'MONGODB_URI',
    process.env.MONGODB_URI,
    'mongodb://127.0.0.1:27017/scientific-files'
  ),
  jwtSecret: requiredInProduction(
    'JWT_SECRET',
    process.env.JWT_SECRET,
    'scientific-files-dev-secret-do-not-use-in-production'
  ),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || '2h',
  adminEmail: process.env.ADMIN_EMAIL?.trim() || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  storage: {
    provider: resolvedProvider,
    // Always absolute: res.sendFile() rejects relative paths, and a relative
    // LOCAL_UPLOAD_DIR would otherwise resolve against the process CWD.
    localUploadDir: path.resolve(
      __dirname,
      '../../',
      process.env.LOCAL_UPLOAD_DIR?.trim() || 'uploads'
    ),
    cloudinary: {
      cloudName: cloudName || '',
      apiKey: cloudApiKey || '',
      apiSecret: cloudApiSecret || '',
      folder: process.env.CLOUDINARY_FOLDER?.trim() || 'scientific-files',
    },
  },
  maxVideoSizeBytes: int(process.env.MAX_VIDEO_SIZE_MB, 200) * 1024 * 1024,
  rateLimit: {
    verifyMax: int(process.env.VERIFY_RATE_LIMIT_MAX, 20),
    verifyWindowMs: int(process.env.VERIFY_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    loginMax: int(process.env.LOGIN_RATE_LIMIT_MAX, 10),
    loginWindowMs: int(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    apiMax: int(process.env.API_RATE_LIMIT_MAX, 300),
    apiWindowMs: int(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  },
  cookieSecure: bool(process.env.COOKIE_SECURE, isProduction),
} as const;

export type Env = typeof env;