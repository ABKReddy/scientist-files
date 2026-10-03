#!/usr/bin/env node
/**
 * Creates `server/.env` from `server/.env.example` with a freshly generated
 * JWT secret, so no real secret ever has to be committed or copied by hand.
 *
 *   npm run setup
 *
 * Re-running never overwrites an existing .env.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, '..', 'server');
const envPath = join(serverDir, '.env');
const examplePath = join(serverDir, '.env.example');

if (existsSync(envPath)) {
  console.log('server/.env already exists — nothing to do.');
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.error('server/.env.example is missing. Cannot create server/.env.');
  process.exit(1);
}

mkdirSync(serverDir, { recursive: true });

const jwtSecret = randomBytes(64).toString('hex');
const contents = readFileSync(examplePath, 'utf8')
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${jwtSecret}`)
  // Strip the placeholder secrets so nothing weak is left behind.
  .replace(/^ADMIN_EMAIL=.*$/m, 'ADMIN_EMAIL=')
  .replace(/^ADMIN_PASSWORD=.*$/m, 'ADMIN_PASSWORD=');

writeFileSync(envPath, contents, 'utf8');

console.log('Created server/.env');
console.log('  • a random 64-byte JWT_SECRET was generated');
console.log('  • now set ADMIN_EMAIL and ADMIN_PASSWORD, then run: npm run seed:admin');
console.log('  • quote values that contain # or spaces, e.g. ADMIN_PASSWORD="My#Secret1"');
