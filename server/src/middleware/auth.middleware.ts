import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Admin } from '../models/Admin';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { AUTH_COOKIE_NAME, verifyToken, type AdminTokenPayload } from '../services/token.service';

const extractToken = (req: Request): string | null => {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) return cookieToken;

  const header = req.headers.authorization;
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim() || null;
  }
  return null;
};

/** Verifies the admin JWT (httpOnly cookie or Bearer header) and loads the admin. */
export const requireAdmin = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required.', 'NO_TOKEN');

  let payload: AdminTokenPayload;
  try {
    payload = verifyToken<AdminTokenPayload>(token, { expectedType: 'admin' });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Your admin session has expired. Please log in again.', 'TOKEN_EXPIRED');
    }
    throw ApiError.unauthorized('Invalid session. Please log in again.', 'INVALID_TOKEN');
  }

  const admin = await Admin.findById(payload.sub).select('+passwordHash').lean();
  if (!admin) throw ApiError.unauthorized('Account no longer exists. Please log in again.', 'ADMIN_NOT_FOUND');

  // A logout (or password change) bumps sessionVersion, instantly revoking old tokens.
  if ((payload.sv ?? 0) !== (admin.sessionVersion ?? 0)) {
    throw ApiError.unauthorized('Your admin session has ended. Please log in again.', 'SESSION_REVOKED');
  }

  req.admin = { id: String(admin._id), email: admin.email, lastLoginAt: admin.lastLoginAt };
  next();
});

/** Populates `req.admin` when a valid token exists, but never rejects the request. */
export const attachAdminIfPresent = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) return next();
    try {
      const payload = verifyToken<AdminTokenPayload>(token, { expectedType: 'admin' });
      const admin = await Admin.findById(payload.sub).lean();
      if (admin) req.admin = { id: String(admin._id), email: admin.email };
    } catch {
      // Ignore invalid tokens on optional routes.
    }
    return next();
  }
);