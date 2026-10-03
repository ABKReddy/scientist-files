import { Router } from 'express';
import { login, logout, me } from '../controllers/auth.controller';
import { attachAdminIfPresent, requireAdmin } from '../middleware/auth.middleware';
import { loginLimiter } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validate.middleware';
import { loginSchema } from '../validators/auth.validator';

const router = Router();

/** POST /api/auth/login — sets the httpOnly JWT cookie. */
router.post('/login', loginLimiter, validate(loginSchema), login);

/** POST /api/auth/logout — clears the session cookie and revokes the token. */
router.post('/logout', attachAdminIfPresent, logout);

/** GET /api/auth/me — current admin (protected). */
router.get('/me', requireAdmin, me);

export default router;