# SCIENTIFIC FILES

> **Every crime reveals a clue.**

A cinematic, full-stack mystery / crime-investigation event platform. Participants unlock
classified video evidence by entering a **5-character alphanumeric code**; organisers upload the
evidence, and the **backend generates a unique code for every clue automatically**.

```
USER                                     ADMIN
────                                     ─────
opens site  ─►  SCIENTIFIC FILES         /admin  ─►  login (JWT + bcrypt)
   │                                        │
   └─► "Every crime reveals a clue."         ├─►  UPLOAD CLUE  (video → object storage)
          │                                 │      └─► VIDEO UPLOADED SUCCESSFULLY
          └─► ENTER CODE ─► [ _ ][ _ ][ _ ][ _ ][ _ ]      │
                            │                               └─► GENERATE CODE
                            └─► GET CLUE ──► backend verifies ──► code saved + displayed
                                    │
                              valid ┴─► CLUE UNLOCKED ─► video player
                              error     "Invalid Code. No clue found."
```

---

## Tech stack

| Layer    | Technology                                                              |
| -------- | ----------------------------------------------------------------------- |
| Frontend | React 18 · Vite 6 · TypeScript · Tailwind CSS 3 · Framer Motion · Axios  |
| Backend  | Node.js · Express 4 · TypeScript · Zod · Helmet · express-rate-limit     |
| Database | MongoDB · Mongoose 8 (`code` carries a **unique index**)                 |
| Auth     | JWT in an **httpOnly cookie** + **bcrypt** (cost 12) + session revocation |
| Video    | **Cloudinary** object storage (dev fallback: local disk) — never in MongoDB |
| Testing  | Vitest · Supertest · in-memory MongoDB · React Testing Library · PowerShell |

---

## 1. Quick start

```bash
cd scientific-files
npm install          # installs both workspaces
npm run setup        # creates server/.env with a random JWT secret
```

Edit `server/.env` and set the first admin credentials:

```env
ADMIN_EMAIL=chief@scientificfiles.local
ADMIN_PASSWORD="Forensics#2026"     # quote it if it contains # or spaces
```

> **You need a MongoDB running.** Either a local `mongod` on `127.0.0.1:27017`
> (or update `MONGODB_URI` to a MongoDB Atlas connection string), then:

```bash
npm run seed:admin     # creates / updates the admin (password is hashed)
npm run dev            # API on :5000  +  client on :5173
```

Open **http://localhost:5173** for the participant site and
**http://localhost:5173/admin** for the admin console.

### Production

```bash
npm run build          # compiles the server to server/dist and the SPA to client/dist
npm start              # runs the compiled API (server/dist/server.js)
```

Serve `client/dist` from any static host (Netlify, Vercel, nginx, …) and point its `/api`
requests at the API host, or serve both behind one reverse proxy.

---

## 2. Environment variables

`npm run setup` copies `server/.env.example` → `server/.env` and fills in a random
`JWT_SECRET`. Everything else is yours to set.

| Variable | Required | Default | Purpose |
| -------- | -------- | ------- | ------- |
| `PORT` | no | `5000` | API port |
| `CLIENT_URL` | yes¹ | `http://localhost:5173` | CORS allow-list (comma-separated) |
| `MONGODB_URI` | **yes** | — | Connection string |
| `JWT_SECRET` | **yes** | dev fallback | Signs admin/stream/upload tokens |
| `JWT_EXPIRES_IN` | no | `2h` | Admin session length |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | for seeding | — | First admin (hashed, never stored plain) |
| `STORAGE_PROVIDER` | no | `cloudinary` if configured, else `local` | Video storage backend |
| `LOCAL_UPLOAD_DIR` | no | `uploads` (in `server/`) | Dev-only storage folder |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | for Cloudinary | — | Object storage credentials |
| `CLOUDINARY_FOLDER` | no | `scientific-files` | Folder in your Cloudinary account |
| `MAX_VIDEO_SIZE_MB` | no | `200` | Upload limit |
| `VERIFY_RATE_LIMIT_MAX` / `_WINDOW_MS` | no | `20` / `900000` | Brute-force protection on code verification |
| `LOGIN_RATE_LIMIT_MAX` / `_WINDOW_MS` | no | `10` / `900000` | Credential-stuffing protection |
| `COOKIE_SECURE` | no | `true` in production | Set `false` only for local plain HTTP |

¹ The API **refuses to start in production** if `MONGODB_URI` or `JWT_SECRET` are missing.

### Cloudinary vs local storage

* `STORAGE_PROVIDER=cloudinary` — files are uploaded as **authenticated** assets and delivered
  through short-lived signed URLs. This is what you want for a real event.
* `STORAGE_PROVIDER=local` — files are written to `server/uploads/` and streamed through the
  token-gated `/api/media/:id` route (with HTTP range support). Perfect for development.

---

## 3. How the security model works

* **No video URL is ever handed to a participant directly.** `POST /api/clues/verify` returns a
  `streamUrl` (`/api/clues/:id/stream?token=…`) whose token expires after 1 hour. The player
  uses that URL; the raw storage link stays server-side. Disabling a clue instantly kills playback.
* **Admin auth** — login sets an httpOnly, SameSite cookie (Secure in production) carrying a JWT.
  It is never written to `localStorage`. `sessionVersion` on the admin document is bumped on
  logout, which revokes every outstanding token for that account.
* **Passwords** are bcrypt-hashed with cost 12 inside a Mongoose pre-save hook, and the hash is
  `select: false` so it cannot leak through a normal query.
* **Code generation** uses `crypto.randomInt` over `A–Z0–9` (rejection-sampled, unbiased),
  pre-checks availability, and relies on a **unique MongoDB index** as the final guard — a
  racing request that slips through is retried automatically.
* **Validation** — every body/query/param is parsed with Zod, control characters are stripped,
  and uploaded videos are sniffed by **magic bytes** (not just the client MIME type).
* **Hardening** — helmet headers, strict CORS, `express-mongo-sanitize`, 1 MB JSON body limit,
  rate limits on login and code verification, and an error handler that never leaks stack
  traces in production.

---

## 4. API reference

### Authentication
| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/api/auth/login` | — | `{ email, password }` → sets httpOnly cookie |
| POST | `/api/auth/logout` | cookie | Clears the cookie **and revokes the token** |
| GET | `/api/auth/me` | ✅ | Current admin |

### Clues
| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/api/clues/upload` | ✅ | `multipart/form-data` video → returns an **upload token** |
| POST | `/api/clues` | ✅ | Creates the clue **and generates its unique code** |
| GET | `/api/clues` | ✅ | List + dashboard stats (`?search=&status=&page=&limit=`) |
| GET | `/api/clues/:id` | ✅ | One clue |
| PATCH | `/api/clues/:id/status` | ✅ | `{ isActive }` enable / disable |
| DELETE | `/api/clues/:id` | ✅ | Removes the document **and** the stored video |

### Public
| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/api/clues/verify` | — | `{ code }` → clue + token-gated `streamUrl` |
| GET | `/api/clues/:id/stream` | token | 302 → storage asset (re-checks the clue is active) |
| GET | `/api/media/:publicId` | token | Local-provider delivery (range requests supported) |
| GET | `/api/health` | — | Liveness + active storage provider |

**Why the two-step upload?** `POST /api/clues/upload` streams the file to storage and returns a
30-minute *upload token* proving the file really came through the API. `POST /api/clues` then
persists the clue and generates the code. The admin never types a code, and it is only minted
once the video is safely stored. `POST /api/clues` also accepts a direct `multipart` upload if
you prefer a single call.

```jsonc
// POST /api/clues/verify  (valid)
{ "success": true, "message": "CLUE UNLOCKED",
  "clue": { "id": "…", "title": "Clue 01", "description": "…",
            "videoUrl": "…", "streamUrl": "/api/clues/…/stream?token=…", "expiresIn": 3600 } }

// invalid code
{ "success": false, "code": "INVALID_CODE", "message": "Invalid Code. No clue found." }

// disabled clue
{ "success": false, "code": "CLUE_UNAVAILABLE", "message": "This clue is currently unavailable." }
```

---

## 5. Database models

```ts
Admin { _id, email (unique), passwordHash, lastLoginAt, sessionVersion, createdAt, updatedAt }

Clue { _id, title, description, videoUrl, videoPublicId, storageProvider,
       code /* unique, exactly 5 × [A-Z0-9] */, isActive, createdBy, createdAt, updatedAt }
```

`code` has `unique: true` plus an explicit `unique_clue_code` index, so duplicates are impossible
even under concurrent writes.

---

## 6. Project structure

```
scientific-files/
├── client/                        React + Vite + TS + Tailwind
│   └── src/
│       ├── components/            CodeSlots · VideoPlayer · ConfirmDialog · ParticleField · Brand · ui
│       ├── pages/
│       │   ├── Welcome/           cinematic landing page
│       │   ├── EnterCode/         5-slot code entry
│       │   ├── ClueVideo/         CLUE UNLOCKED + player
│       │   └── admin/             Login · Dashboard · UploadClue · ManageClues
│       ├── layouts/               PublicLayout · AdminLayout
│       ├── context/               AuthContext · ToastContext
│       ├── services/              apiClient · authService · clueService
│       ├── utils/                 format · unlockedClue
│       └── types/                 shared API types
├── server/                        Express + TS
│   └── src/
│       ├── config/                env · db
│       ├── models/                Admin · Clue
│       ├── controllers/           auth · clue
│       ├── routes/                auth.routes · clue.routes
│       ├── middleware/            auth · validate · upload · rateLimit · error
│       ├── services/              code · storage (Cloudinary/local) · token
│       ├── validators/            zod schemas
│       ├── scripts/seedAdmin.ts
│       └── app.ts · server.ts
├── scripts/setup-env.mjs          creates server/.env with a random JWT secret
├── scripts/e2e-smoke.ps1          live end-to-end test against a running server
└── package.json                   npm workspaces
```

---

## 7. Testing

```bash
npm test              # server (33) + client (20) unit/integration tests
npm run test:server   # API tests on an in-memory MongoDB (no setup needed)
npm run test:client   # React Testing Library component tests (jsdom)
npm run test:e2e      # live smoke test — requires a running server
```

The server suite (`mongodb-memory-server` boots a throwaway MongoDB) covers login, the
httpOnly cookie, unauthorised access, upload → generate → verify → stream (including HTTP range
requests), disable/enable, delete + file cleanup, upload validation, duplicate-code prevention,
NoSQL-injection payloads and rate limiting.

`npm run test:e2e` drives the real HTTP API end to end (login → upload → code → verify → stream →
disable → enable → delete → logout) and cleans up after itself:

```powershell
npm run test:e2e
# optional: -SkipRateLimit, or set $env:SF_ADMIN_EMAIL / SF_ADMIN_PASSWORD / SF_BASE_URL
```

> The public rate limiter allows 20 verifications per 15 minutes per IP by default. The e2e
> script detects an exhausted window and tells you to wait or raise `VERIFY_RATE_LIMIT_MAX`.

---

## 8. UI notes

* Dark charcoal / black palette with crimson and electric-blue accents, glassmorphism panels, a
  canvas particle field, a scanning light sweep and a subtle noise overlay.
* The title animates with a letter-spacing reveal; page transitions cross-fade between routes;
  all motion is disabled under `prefers-reduced-motion`.
* Fully responsive: the five code slots stay visible and tappable on phones (16 px inputs to stop
  iOS zoom), the player scales to any width, and the admin table becomes cards on small screens.
* Every action has a loading state (login, upload with progress bar, code generation, deletion,
  enable/disable) and every failure has a specific message.

---

## 9. Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `Missing required environment variable "MONGODB_URI"` | Run `npm run setup` and fill in `server/.env` |
| `ECONNREFUSED 127.0.0.1:27017` | Start MongoDB, or point `MONGODB_URI` at Atlas |
| `Invalid email or password` after seeding | `ADMIN_PASSWORD` must be ≥ 10 chars; quote values containing `#` |
| Upload fails immediately | `STORAGE_PROVIDER=local` needs a writable `server/uploads` (created automatically) |
| Cloudinary upload fails | Check all three `CLOUDINARY_*` values and that the folder exists |
| Video will not play | Use H.264 MP4 (`.mp4`) — MOV/WebM depend on browser codec support |
| 429 from `POST /api/clues/verify` | Expected after many attempts; wait for the window or raise the limit |

---

## 10. Before you run a real event

1. Use a **strong, unique** `JWT_SECRET` and admin password.
2. Switch to `STORAGE_PROVIDER=cloudinary` so videos are served from a CDN.
3. Serve over **HTTPS** and keep `COOKIE_SECURE=true`.
4. Set `CLIENT_URL` to your real domain and `NODE_ENV=production`.
5. Back up MongoDB — codes are the only way into your clues.