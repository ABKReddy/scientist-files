import fs from 'fs';
import os from 'os';
import path from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Boots an in-memory MongoDB for the test run and injects the env the API needs.
 * `pool: 'forks'` in vitest.config.ts guarantees the env is inherited by workers.
 */
export default async function setup(): Promise<() => Promise<void>> {
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-uploads-'));

  process.env.NODE_ENV = 'test';
  process.env.PORT = '5051';
  process.env.CLIENT_URL = 'http://localhost:5173';
  process.env.JWT_SECRET = 'test-only-secret-scientific-files-0123456789';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.STORAGE_PROVIDER = 'local';
  process.env.LOCAL_UPLOAD_DIR = uploadDir;
  process.env.COOKIE_SECURE = 'false';
  // High enough that the functional suite never trips it; the limiter itself is
  // verified in tests/rateLimit.test.ts, which boots its own app with a tiny limit.
  process.env.VERIFY_RATE_LIMIT_MAX = '200';
  process.env.VERIFY_RATE_LIMIT_WINDOW_MS = '60000';
  process.env.LOGIN_RATE_LIMIT_MAX = '50';
  process.env.API_RATE_LIMIT_MAX = '10000';

  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('scientific-files-test');

  return async () => {
    await mongo.stop();
    try {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  };
}