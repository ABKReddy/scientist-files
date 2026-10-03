import multer from 'multer';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { ALLOWED_VIDEO_MIME_TYPES } from '../services/storage.service';

const ALLOWED_EXTENSIONS = ['.mp4', '.m4v', '.mov', '.webm', '.ogv'];

/**
 * Videos are held in memory and streamed straight to object storage, so large
 * files never touch MongoDB or the local disk.
 */
const storage = multer.memoryStorage();

export const uploadSingleVideo = multer({
  storage,
  limits: {
    fileSize: env.maxVideoSizeBytes,
    files: 1,
    fields: 20,
    parts: 25,
  },
  fileFilter: (_req, file, cb) => {
    const lowerName = (file.originalname || '').toLowerCase();
    const hasKnownExtension = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

    if (ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype) && hasKnownExtension) {
      cb(null, true);
      return;
    }
    cb(
      ApiError.badRequest(
        'Unsupported file type. Please upload an MP4, WebM or MOV video.',
        'INVALID_FILE_TYPE'
      )
    );
  },
}).single('video');

/** Wraps multer so its errors surface as consistent API errors. */
export const handleVideoUpload: RequestHandler = (req, res, next) => {
  uploadSingleVideo(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        const maxMb = Math.round(env.maxVideoSizeBytes / (1024 * 1024));
        return next(
          ApiError.payloadTooLarge(`Video is too large. Maximum file size is ${maxMb} MB.`, 'FILE_TOO_LARGE')
        );
      }
      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(ApiError.badRequest('Unexpected file field. Use the "video" field.', 'INVALID_FILE_FIELD'));
      }
      return next(ApiError.badRequest(`Upload failed: ${error.message}.`, 'UPLOAD_FAILED'));
    }
    return next(error);
  });
};