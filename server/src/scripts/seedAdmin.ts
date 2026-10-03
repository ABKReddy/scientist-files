/**
 * Creates (or updates) the first admin account.
 *
 *   npm run seed:admin
 *
 * Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD in server/.env — never
 * hardcoded here. The password is hashed by the Admin model's pre-save hook.
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { Admin } from '../models/Admin';
import { logger } from '../utils/logger';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const run = async (): Promise<void> => {
  const email = env.adminEmail.toLowerCase();
  const password = env.adminPassword;

  if (!email || !password) {
    logger.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in server/.env before seeding.');
    process.exitCode = 1;
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    logger.error(`"${email}" is not a valid email address.`);
    process.exitCode = 1;
    return;
  }
  if (password.length < 10) {
    logger.error('ADMIN_PASSWORD must be at least 10 characters long.');
    process.exitCode = 1;
    return;
  }

  await connectDatabase();
  logger.info('Connected to MongoDB');

  const existing = await Admin.findOne({ email });
  const admin = existing ?? new Admin({ email, passwordHash: password });

  if (existing) {
    admin.passwordHash = password;
    admin.markModified('passwordHash');
    await admin.save();
    logger.info(`Updated existing admin: ${email}`);
  } else {
    await admin.save();
    logger.info(`Created admin account: ${email}`);
  }

  await disconnectDatabase();
  logger.info('Admin seed complete. You can now sign in at /admin/login.');
};

run().catch(async (error) => {
  logger.error('Admin seed failed', error);
  await disconnectDatabase().catch(() => undefined);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});