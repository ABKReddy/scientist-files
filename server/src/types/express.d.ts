import type { Types } from 'mongoose';

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  lastLoginAt?: Date | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by `requireAdmin` for protected routes. */
      admin?: AuthenticatedAdmin;
      /** Object id that passed the `isValidObjectId` guard. */
      resourceId?: Types.ObjectId;
    }
  }
}

export {};