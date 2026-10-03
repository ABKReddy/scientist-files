import { Router } from 'express';
import {
  createClue,
  deleteClue,
  getClue,
  listClues,
  serveLocalMedia,
  streamClue,
  updateClueStatus,
  uploadClueVideo,
  verifyCode,
} from '../controllers/clue.controller';
import { requireAdmin } from '../middleware/auth.middleware';
import { verifyLimiter } from '../middleware/rateLimit.middleware';
import { handleVideoUpload } from '../middleware/upload.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  clueStatusSchema,
  createClueSchema,
  listCluesSchema,
  objectIdSchema,
  verifyCodeSchema,
} from '../validators/clue.validator';

const router = Router();

// ── Public ───────────────────────────────────────────────────────────────────

/** POST /api/clues/verify — rate limited so codes cannot be brute-forced. */
router.post('/verify', verifyLimiter, validate(verifyCodeSchema), verifyCode);

/** GET /api/clues/:id/stream?token=… — token-gated playback redirect. */
router.get('/:id/stream', streamClue);

// ── Admin (all below require a valid admin JWT) ──────────────────────────────

router.post('/upload', requireAdmin, handleVideoUpload, uploadClueVideo);

router.post('/', requireAdmin, handleVideoUpload, validate(createClueSchema), createClue);

router.get('/', requireAdmin, validate(listCluesSchema, 'query'), listClues);

router.get('/:id', requireAdmin, validate(objectIdSchema, 'params'), getClue);

router.patch(
  '/:id/status',
  requireAdmin,
  validate(objectIdSchema, 'params'),
  validate(clueStatusSchema),
  updateClueStatus
);

router.delete('/:id', requireAdmin, validate(objectIdSchema, 'params'), deleteClue);

export default router;

/** Local-storage media delivery lives under /api/media (mounted separately). */
export const mediaRouter = Router();
mediaRouter.get('/:publicId', serveLocalMedia);