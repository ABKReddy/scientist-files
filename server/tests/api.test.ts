import fs from 'fs';
import path from 'path';
import request from 'supertest';
import type { Express } from 'express';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import { env } from '../src/config/env';
import { Admin } from '../src/models/Admin';
import { Clue } from '../src/models/Clue';
import { createApp } from '../src/app';

const ADMIN_EMAIL = 'chief@scientificfiles.test';
const ADMIN_PASSWORD = 'Forensics#2026';

let app: Express;

/** Minimal but structurally valid MP4 header (only the signature matters here). */
const makeMp4 = (): Buffer => {
  const header = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x20]),
    Buffer.from('ftyp', 'latin1'),
    Buffer.from('isom', 'latin1'),
    Buffer.from([0x00, 0x00, 0x02, 0x00]),
    Buffer.from('isomiso2mp41', 'latin1'),
  ]);
  const body = Buffer.alloc(64 * 1024, 0x42); // filler payload
  return Buffer.concat([header, body]);
};

const login = async (): Promise<string> => {
  const response = await request(app).post('/api/auth/login').send({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  const cookies = response.headers['set-cookie'];
  expect(cookies, 'login should set a session cookie').toBeDefined();
  return (cookies as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
};

beforeAll(async () => {
  await connectDatabase();
  await Admin.deleteMany({});
  await Clue.deleteMany({});
  await Admin.create({ email: ADMIN_EMAIL, passwordHash: ADMIN_PASSWORD });
  app = createApp();
});

afterAll(async () => {
  await disconnectDatabase();
});

describe('GET /api/health', () => {
  it('reports the active storage provider', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body.status).toBe('operational');
    expect(response.body.storage).toBe('local');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Authentication', () => {
  it('rejects a missing body', async () => {
    const response = await request(app).post('/api/auth/login').send({}).expect(400);
    expect(response.body.success).toBe(false);
  });

  it('rejects an unknown email with a generic message', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.local', password: 'whatever' })
      .expect(401);
    expect(response.body.message).toBe('Invalid email or password.');
  });

  it('rejects a wrong password with the same message', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'wrong-password' })
      .expect(401);
    expect(response.body.message).toBe('Invalid email or password.');
  });

  it('logs in with valid credentials and sets an httpOnly cookie', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.admin.email).toBe(ADMIN_EMAIL);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toContain('HttpOnly');
    expect(cookies.join(';')).toContain('sf_admin_token');
  });

  it('never returns the password hash', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    expect(JSON.stringify(response.body)).not.toContain('$2a$');
    expect(response.body.admin).not.toHaveProperty('passwordHash');
  });

  it('blocks /api/auth/me without a token', async () => {
    const response = await request(app).get('/api/auth/me').expect(401);
    expect(response.body.code).toBe('NO_TOKEN');
  });

  it('returns the current admin with a valid cookie', async () => {
    const cookie = await login();
    const response = await request(app).get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(response.body.admin.email).toBe(ADMIN_EMAIL);
  });

  it('rejects a forged token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.real.token')
      .expect(401);
    expect(response.body.code).toBe('INVALID_TOKEN');
  });

  it('clears the cookie on logout', async () => {
    const cookie = await login();
    const response = await request(app).post('/api/auth/logout').set('Cookie', cookie).expect(200);
    expect(response.body.success).toBe(true);
    const cookies = (response.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookies).toContain('sf_admin_token=;');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Authorization on admin routes', () => {
  it('blocks unauthenticated GET /api/clues', async () => {
    const response = await request(app).get('/api/clues').expect(401);
    expect(response.body.code).toBe('NO_TOKEN');
  });

  it('blocks unauthenticated POST /api/clues', async () => {
    await request(app).post('/api/clues').expect(401);
  });

  it('blocks unauthenticated POST /api/clues/upload', async () => {
    await request(app).post('/api/clues/upload').expect(401);
  });

  it('rejects an invalid clue id before hitting the database', async () => {
    const cookie = await login();
    const response = await request(app).get('/api/clues/not-an-id').set('Cookie', cookie).expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Upload → generate code → verify → manage', () => {
  it('runs the complete admin and participant workflow', async () => {
    const cookie = await login();

    // 1. Upload the video (step 1)
    const upload = await request(app)
      .post('/api/clues/upload')
      .set('Cookie', cookie)
      .attach('video', makeMp4(), { filename: 'evidence.mp4', contentType: 'video/mp4' })
      .expect(201);

    expect(upload.body.message).toBe('VIDEO UPLOADED SUCCESSFULLY');
    expect(upload.body.upload.uploadToken).toBeTruthy();
    expect(upload.body.upload.storageProvider).toBe('local');

    // 2. Generate the code (step 2) — the admin never types a code
    const created = await request(app)
      .post('/api/clues')
      .set('Cookie', cookie)
      .send({ title: 'Clue 01', description: 'First scientific clue', uploadToken: upload.body.upload.uploadToken })
      .expect(201);

    const clue = created.body.clue;
    expect(created.body.message).toBe('CLUE CREATED SUCCESSFULLY');
    expect(clue.code).toMatch(/^[A-Z0-9]{5}$/);
    expect(clue.isActive).toBe(true);
    expect(clue.title).toBe('Clue 01');

    // 3. Participant enters the code
    const verified = await request(app).post('/api/clues/verify').send({ code: clue.code }).expect(200);
    expect(verified.body.success).toBe(true);
    expect(verified.body.clue.title).toBe('Clue 01');
    expect(verified.body.clue.streamUrl).toContain('/stream?token=');

    // 4. The stream URL is a token-gated redirect to the media route
    const stream = await request(app).get(verified.body.clue.streamUrl).expect(302);
    expect(stream.headers.location).toContain('/api/media/');

    // 5. The media route serves the real bytes (with range support for seeking)
    const media = await request(app).get(stream.headers.location).expect(200);
    expect(media.headers['content-type']).toContain('video/mp4');
    expect(media.body.length).toBeGreaterThan(1024);

    const ranged = await request(app).get(stream.headers.location).set('Range', 'bytes=0-99').expect(206);
    expect(ranged.body.length).toBe(100);

    // 6. Admin listing shows the clue + dashboard statistics
    const list = await request(app).get('/api/clues').set('Cookie', cookie).expect(200);
    expect(list.body.clues).toHaveLength(1);
    expect(list.body.stats.totalClues).toBe(1);
    expect(list.body.stats.activeClues).toBe(1);
    expect(list.body.stats.generatedCodes).toBe(1);

    // 7. Lowercase codes are accepted (user-friendly input)
    await request(app).post('/api/clues/verify').send({ code: clue.code.toLowerCase() }).expect(200);

    // 8. Disable → the video is no longer reachable
    const disabled = await request(app)
      .patch(`/api/clues/${clue.id}/status`)
      .set('Cookie', cookie)
      .send({ isActive: false })
      .expect(200);
    expect(disabled.body.clue.isActive).toBe(false);

    const blocked = await request(app).post('/api/clues/verify').send({ code: clue.code }).expect(403);
    expect(blocked.body.message).toBe('This clue is currently unavailable.');
    await request(app).get(stream.headers.location).expect(403);

    // 9. Re-enable → playable again
    await request(app)
      .patch(`/api/clues/${clue.id}/status`)
      .set('Cookie', cookie)
      .send({ isActive: true })
      .expect(200);
    await request(app).post('/api/clues/verify').send({ code: clue.code }).expect(200);

    // 10. Delete → document gone and the stored file removed
    const storedFile = path.join(env.storage.localUploadDir, clue.videoPublicId);
    expect(fs.existsSync(storedFile)).toBe(true);

    await request(app).delete(`/api/clues/${clue.id}`).set('Cookie', cookie).expect(200);
    expect(fs.existsSync(storedFile)).toBe(false);
    await request(app).get(`/api/clues/${clue.id}`).set('Cookie', cookie).expect(404);
    await request(app).post('/api/clues/verify').send({ code: clue.code }).expect(404);
  });

  it('accepts a direct multipart create (single-request flow)', async () => {
    const cookie = await login();
    const response = await request(app)
      .post('/api/clues')
      .set('Cookie', cookie)
      .field('title', 'Clue Direct')
      .attach('video', makeMp4(), { filename: 'direct.mp4', contentType: 'video/mp4' })
      .expect(201);
    expect(response.body.clue.code).toMatch(/^[A-Z0-9]{5}$/);

    await request(app).delete(`/api/clues/${response.body.clue.id}`).set('Cookie', cookie).expect(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Code verification errors', () => {
  it('rejects an unknown code without leaking which slot was wrong', async () => {
    const response = await request(app).post('/api/clues/verify').send({ code: 'ZZZZZ' }).expect(404);
    expect(response.body.message).toBe('Invalid Code. No clue found.');
    expect(response.body.code).toBe('INVALID_CODE');
  });

  it.each(['AB', 'ABCDEF', 'AB-1D', '     ', ''])('rejects malformed code "%s"', async (code) => {
    const response = await request(app).post('/api/clues/verify').send({ code }).expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a NoSQL operator injection attempt', async () => {
    await request(app).post('/api/clues/verify').send({ code: { $ne: null } }).expect(400);
  });

  it('rejects a stream URL without a token', async () => {
    await request(app).get('/api/clues/000000000000000000000000/stream').expect(401);
  });

  it('returns 404 for an unknown route', async () => {
    const response = await request(app).get('/api/does-not-exist').expect(404);
    expect(response.body.code).toBe('ROUTE_NOT_FOUND');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Upload validation', () => {
  it('rejects a non-video file (magic-byte sniffing)', async () => {
    const cookie = await login();
    const response = await request(app)
      .post('/api/clues/upload')
      .set('Cookie', cookie)
      .attach('video', Buffer.from('this is definitely not a video'), {
        filename: 'payload.mp4',
        contentType: 'video/mp4',
      })
      .expect(400);
    expect(response.body.message).toMatch(/Unsupported video file/i);
  });

  it('rejects an unsupported mime type', async () => {
    const cookie = await login();
    await request(app)
      .post('/api/clues/upload')
      .set('Cookie', cookie)
      .attach('video', makeMp4(), { filename: 'payload.exe', contentType: 'application/octet-stream' })
      .expect(400);
  });

  it('requires a video on create', async () => {
    const cookie = await login();
    const response = await request(app)
      .post('/api/clues')
      .set('Cookie', cookie)
      .send({ title: 'No video here' })
      .expect(400);
    expect(response.body.message).toBe('A video is required to create a clue.');
  });

  it('rejects a forged upload token', async () => {
    const cookie = await login();
    await request(app)
      .post('/api/clues')
      .set('Cookie', cookie)
      .send({ title: 'Forged', uploadToken: 'a'.repeat(40) })
      .expect(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Code generation', () => {
  it('produces unique random codes across many clues', async () => {
    const cookie = await login();
    const codes = new Set<string>();

    for (let i = 0; i < 12; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const upload = await request(app)
        .post('/api/clues/upload')
        .set('Cookie', cookie)
        .attach('video', makeMp4(), { filename: `clue-${i}.mp4`, contentType: 'video/mp4' });

      // eslint-disable-next-line no-await-in-loop
      const created = await request(app)
        .post('/api/clues')
        .set('Cookie', cookie)
        .send({ title: `Batch clue ${i}`, uploadToken: upload.body.upload.uploadToken })
        .expect(201);

      expect(created.body.clue.code).toMatch(/^[A-Z0-9]{5}$/);
      codes.add(created.body.clue.code);
    }

    expect(codes.size).toBe(12);

    const docs = await Clue.find({});
    expect(
      docs.map((doc) => `${doc.title}:${doc.code}`),
      'only the clues created in this test should exist'
    ).toHaveLength(12);
    for (const doc of docs) expect(doc.code).toMatch(/^[A-Z0-9]{5}$/);

    // Every generated code resolves to exactly one clue.
    for (const code of codes) {
      // eslint-disable-next-line no-await-in-loop
      expect(await Clue.find({ code })).toHaveLength(1);
    }

    await Clue.deleteMany({});
    fs.readdirSync(env.storage.localUploadDir).forEach((file) =>
      fs.rmSync(path.join(env.storage.localUploadDir, file), { force: true })
    );
  });

  it('enforces uniqueness with a database index', async () => {
    const indexes = await Clue.collection.indexes();
    const uniqueIndex = indexes.find((index) => index.key && (index.key as { code?: number }).code === 1);
    expect(uniqueIndex).toBeDefined();
    expect(uniqueIndex?.unique).toBe(true);

    await Clue.create({
      title: 'First',
      videoUrl: '/api/media/a.mp4',
      videoPublicId: 'a.mp4',
      storageProvider: 'local',
      code: 'TEST1',
    });
    await expect(
      Clue.create({
        title: 'Second',
        videoUrl: '/api/media/b.mp4',
        videoPublicId: 'b.mp4',
        storageProvider: 'local',
        code: 'TEST1',
      })
    ).rejects.toMatchObject({ code: 11000 });

    await Clue.deleteMany({});
  });
});