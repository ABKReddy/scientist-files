export interface ApiErrorPayload {
  success: false;
  code: string;
  message: string;
  errors?: { field: string; message: string }[];
}

/** Normalised error used across the whole client. */
export interface AppError {
  status: number;
  code: string;
  message: string;
  errors?: { field: string; message: string }[];
}

export interface AdminUser {
  id: string;
  email: string;
  lastLoginAt?: string | null;
}

export interface Clue {
  id: string;
  title: string;
  description: string;
  code: string;
  videoUrl: string;
  videoPublicId: string;
  storageProvider: 'cloudinary' | 'local';
  videoStatus: 'uploaded' | 'missing';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The trimmed payload a participant receives after a valid code. */
export interface UnlockedClue {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  streamUrl: string;
  expiresIn: number;
}

export interface ClueStats {
  totalClues: number;
  activeClues: number;
  inactiveClues: number;
  generatedCodes: number;
}

export interface ListCluesResponse {
  clues: Clue[];
  stats: ClueStats;
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface UploadTicket {
  videoUrl: string;
  videoPublicId: string;
  storageProvider: 'cloudinary' | 'local';
  format: string;
  bytes: number;
  uploadToken: string;
}

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}