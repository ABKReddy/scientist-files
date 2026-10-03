import request from 'supertest';
import type { Express } from 'express';

// Must be set before the app (and its limiters) are imported — `pool: 'forks'`
// gives this file a clean module registry, so the limit only applies here.
process.env.VERIFY_RATE_LIMIT_MAX = '4';
process.env.VERIFY_RATE_LIMIT_WINDOW_MS = '60000';

let app: Express;

beforeAll(async () => {
  const { connectDatabase } = await import('../src/config/db');
  const { createApp } = await import('../src/app');
  await connectDatabase();
  app = createApp();
});

describe('Rate limiting on the public verification endpoint', () => {
  it('allows a few attempts, then answers 429', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      const response = await request(app).post('/api/clues/verify').send({ code: 'ZZZZZ' });
      statuses.push(response.status);
      if (response.status === 429) {
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('RATE_LIMITED');
        expect(response.body.message).toMatch(/Too many attempts/i);
      }
    }

    expect(statuses.slice(0, 4)).toEqual([404, 404, 404, 404]);
    expect(statuses.slice(4)).toEqual([429, 429, 429, 429]);
  });

  it('leaves the health endpoint open', async () => {
    await request(app).get('/api/health').expect(200);
  });
});