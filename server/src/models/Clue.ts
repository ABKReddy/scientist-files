import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { CODE_LENGTH } from '../utils/codeGenerator';

export interface IClue {
  title: string;
  description?: string;
  videoUrl: string;
  videoPublicId: string;
  storageProvider: 'cloudinary' | 'local';
  code: string;
  isActive: boolean;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ClueDocument = HydratedDocument<IClue>;

const clueSchema = new Schema<IClue>(
  {
    title: {
      type: String,
      required: [true, 'Clue title is required'],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    videoUrl: {
      type: String,
      required: [true, 'Video URL is required'],
      trim: true,
    },
    videoPublicId: {
      type: String,
      required: [true, 'Video public id is required'],
      trim: true,
    },
    storageProvider: {
      type: String,
      enum: ['cloudinary', 'local'],
      required: true,
      default: 'local',
    },
    code: {
      type: String,
      required: [true, 'Clue code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: CODE_LENGTH,
      maxlength: CODE_LENGTH,
      match: [/^[A-Z0-9]{5}$/, 'Code must be exactly 5 uppercase alphanumeric characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for the admin listing (newest first) and fast code lookups.
clueSchema.index({ createdAt: -1 });
clueSchema.index({ code: 1 }, { unique: true, name: 'unique_clue_code' });

export const Clue: Model<IClue> = model<IClue>('Clue', clueSchema);