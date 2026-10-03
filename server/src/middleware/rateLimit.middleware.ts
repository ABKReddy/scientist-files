import type { Request, Response } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { env } from '../config/env';

type LimitScope = 'verify' | 'login' | 'api';

/**
 * express-rate-limit v7 widens the handler type with reset helpers we don't use,
 * so the plain express handler is cast here.
 */
const handlerFor =
  (scope: LimitScope) =>
  ((_req: Request, res: Response): void => {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      message:
        scope === 'verify'
          ? 'Too many attempts. Please wait a moment before trying another code.'
          : 'Too many requests. Please try again later.',
    });
  }) as unknown as RateLimitRequestHandler;

/** Broad safety net for the whole API surface. */
export const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: env.rateLimit.apiWindowMs,
  limit: env.rateLimit.apiMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: handlerFor('api'),
});

/** Public code verification — brute-forcing 5-char codes must be expensive. */
export const verifyLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: env.rateLimit.verifyWindowMs,
  limit: env.rateLimit.verifyMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: handlerFor('verify'),
});

/** Credential stuffing protection on the admin login route. */
export const loginLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: env.rateLimit.loginWindowMs,
  limit: env.rateLimit.loginMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: handlerFor('login'),
});