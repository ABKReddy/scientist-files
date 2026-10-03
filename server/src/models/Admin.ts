import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IAdmin {
  email: string;
  passwordHash: string;
  lastLoginAt?: Date | null;
  /**
   * Bumped on logout / password change. Any JWT issued with an older version is
   * rejected, so signing out really kills the session (no server-side session store needed).
   */
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

interface IAdminMethods {
  verifyPassword(candidate: string): Promise<boolean>;
}

export type AdminDocument = HydratedDocument<IAdmin, IAdminMethods>;
export type AdminModel = Model<IAdmin, Record<string, never>, IAdminMethods>;

const SALT_ROUNDS = 12;

const adminSchema = new Schema<IAdmin, AdminModel, IAdminMethods>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    lastLoginAt: { type: Date, default: null },
    sessionVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/** Hashes the password whenever a plaintext `password` field is assigned. */
adminSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
    return next();
  } catch (error) {
    return next(error as Error);
  }
});

adminSchema.methods.verifyPassword = function verifyPassword(candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

adminSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).passwordHash;
    return ret;
  },
});

export const Admin: AdminModel = model<IAdmin, AdminModel>('Admin', adminSchema);
export type AdminId = Types.ObjectId;