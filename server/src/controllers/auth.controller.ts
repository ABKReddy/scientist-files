import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Admin } from '../models/Admin';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { AUTH_COOKIE_NAME, cookieOptions, signAdminToken } from '../services/token.service';
import type { LoginInput } from '../validators/auth.validator';
import { logger } from '../utils/logger';

/**
 * A real hash of a throw-away secret, computed once at boot. Comparing against it
 * keeps the "unknown email" path as slow as the "wrong password" path, so response
 * timing cannot be used to discover which accounts exist.
 */
const TIMING_GUARD_HASH = bcrypt.hashSync('scientific-files-timing-guard', 12);

/**
 * POST /api/auth/login
 * Verifies credentials, issues a JWT in an httpOnly cookie (never in localStorage).
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;

  const admin = await Admin.findOne({ email }).select('+passwordHash');
  // Same message for unknown email and wrong password — no account enumeration.
  const invalid = ApiError.unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');

  if (!admin) {
    await bcrypt.compare(password, TIMING_GUARD_HASH);
    throw invalid;
  }

  const passwordMatches = await admin.verifyPassword(password);
  if (!passwordMatches) {
    logger.warn('Failed admin login attempt', { email });
    throw invalid;
  }

  admin.lastLoginAt = new Date();
  await admin.save({ validateBeforeSave: false });

  const token = signAdminToken(String(admin._id), admin.email, admin.sessionVersion ?? 0);
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);

  res.json({
    success: true,
    message: 'Access granted.',
    admin: { id: String(admin._id), email: admin.email, lastLoginAt: admin.lastLoginAt },
  });
});

/**
 * POST /api/auth/logout
 * Clears the cookie AND revokes the session by bumping `sessionVersion`, so a
 * copied JWT stops working immediately (stateless JWTs are otherwise replayable).
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.admin) {
    await Admin.updateOne({ _id: req.admin.id }, { $inc: { sessionVersion: 1 } });
  }
  res.clearCookie(AUTH_COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  res.json({ success: true, message: 'Logged out.' });
});

/** GET /api/auth/me */
export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    admin: { id: req.admin!.id, email: req.admin!.email, lastLoginAt: req.admin!.lastLoginAt ?? null },
  });
});