import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface AdminTokenPayload {
  sub: string;
  email: string;
  /** Session version at the time the token was issued. */
  sv: number;
  type: 'admin';
}

/** Token used by participants to stream one clue video for a short window. */
export interface StreamTokenPayload {
  sub: string;
  type: 'stream';
}

export interface UploadTokenPayload {
  sub: string;
  videoUrl: string;
  videoPublicId: string;
  storageProvider: 'cloudinary' | 'local';
  type: 'upload';
}

export const AUTH_COOKIE_NAME = 'sf_admin_token';
export const STREAM_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const UPLOAD_TOKEN_TTL_SECONDS = 60 * 30; // 30 minutes

export const signAdminToken = (adminId: string, email: string, sessionVersion = 0): string =>
  jwt.sign({ sub: adminId, email, sv: sessionVersion, type: 'admin' } satisfies AdminTokenPayload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  });

export const signStreamToken = (clueId: string): string =>
  jwt.sign({ sub: clueId, type: 'stream' } satisfies StreamTokenPayload, env.jwtSecret, {
    expiresIn: STREAM_TOKEN_TTL_SECONDS,
  });

export const signUploadToken = (
  adminId: string,
  videoUrl: string,
  videoPublicId: string,
  storageProvider: 'cloudinary' | 'local'
): string =>
  jwt.sign(
    { sub: adminId, videoUrl, videoPublicId, storageProvider, type: 'upload' } satisfies UploadTokenPayload,
    env.jwtSecret,
    { expiresIn: UPLOAD_TOKEN_TTL_SECONDS }
  );

type TokenType = AdminTokenPayload['type'] | StreamTokenPayload['type'] | UploadTokenPayload['type'];

export const verifyToken = <T extends AdminTokenPayload | StreamTokenPayload | UploadTokenPayload>(
  token: string,
  { expectedType }: { expectedType: TokenType }
): T => {
  const decoded = jwt.verify(token, env.jwtSecret) as T & { type?: string };
  if (decoded.type !== expectedType) {
    throw new jwt.JsonWebTokenError('Unexpected token type');
  }
  return decoded;
};

export const cookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.isProduction ? ('none' as const) : ('lax' as const),
  path: '/',
  maxAge: 1000 * 60 * 60 * 8,
};