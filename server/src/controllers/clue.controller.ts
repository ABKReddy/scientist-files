import fs from 'fs';
import type { Request, Response } from 'express';
import { Clue, type ClueDocument } from '../models/Clue';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { generateUniqueCode, isCodeDuplicateKeyError } from '../services/code.service';
import {
  deleteVideo,
  localFilePath,
  mimeForPublicId,
  resolvePlaybackUrl,
  storageProviderName,
  uploadVideo,
  type StoredVideo,
} from '../services/storage.service';
import {
  STREAM_TOKEN_TTL_SECONDS,
  signStreamToken,
  signUploadToken,
  verifyToken,
  type StreamTokenPayload,
  type UploadTokenPayload,
} from '../services/token.service';
import type { CreateClueInput, ListCluesInput } from '../validators/clue.validator';

const MAX_CODE_INSERT_ATTEMPTS = 6;

interface StagedVideo {
  videoUrl: string;
  videoPublicId: string;
  storageProvider: 'cloudinary' | 'local';
}

/** Shape sent to the admin UI (includes the raw storage URL — admins only). */
const toAdminClue = (clue: ClueDocument) => ({
  id: String(clue._id),
  title: clue.title,
  description: clue.description ?? '',
  code: clue.code,
  videoUrl: clue.videoUrl,
  videoPublicId: clue.videoPublicId,
  storageProvider: clue.storageProvider,
  videoStatus: clue.videoUrl ? 'uploaded' : 'missing',
  isActive: clue.isActive,
  createdAt: clue.createdAt,
  updatedAt: clue.updatedAt,
});

/** Inserts a clue, retrying with a fresh code if another request won the race. */
const createClueWithUniqueCode = async (payload: StagedVideo & {
  title: string;
  description: string;
  createdBy?: string;
}): Promise<ClueDocument> => {
  for (let attempt = 1; attempt <= MAX_CODE_INSERT_ATTEMPTS; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const code = await generateUniqueCode(async (candidate) => (await Clue.exists({ code: candidate })) !== null);
    try {
      // eslint-disable-next-line no-await-in-loop
      return await Clue.create({
        title: payload.title,
        description: payload.description,
        videoUrl: payload.videoUrl,
        videoPublicId: payload.videoPublicId,
        storageProvider: payload.storageProvider,
        code,
        isActive: true,
        createdBy: payload.createdBy ?? null,
      });
    } catch (error) {
      if (isCodeDuplicateKeyError(error)) {
        logger.warn('Clue code collision caught by unique index — regenerating', { attempt });
        continue;
      }
      throw error;
    }
  }
  throw ApiError.internal('Could not generate a unique clue code. Please try again.', 'CODE_GENERATION_FAILED');
};

const resolveStagedVideoFromToken = (uploadToken: string, adminId: string): StagedVideo => {
  let payload: UploadTokenPayload;
  try {
    payload = verifyToken<UploadTokenPayload>(uploadToken, { expectedType: 'upload' });
  } catch {
    throw ApiError.badRequest('Upload session expired. Please upload the video again.', 'UPLOAD_TOKEN_INVALID');
  }
  if (payload.sub !== adminId) {
    throw ApiError.forbidden('This upload belongs to a different admin session.', 'UPLOAD_TOKEN_MISMATCH');
  }
  if (!payload.videoUrl || !payload.videoPublicId) {
    throw ApiError.badRequest('Upload session is incomplete. Please upload the video again.', 'UPLOAD_TOKEN_INVALID');
  }
  return { videoUrl: payload.videoUrl, videoPublicId: payload.videoPublicId, storageProvider: payload.storageProvider };
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/clues/upload — step 1 of the admin flow.
 * Streams the video to object storage and returns a short-lived upload token.
 */
export const uploadClueVideo = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest('Please choose a video file to upload.', 'VIDEO_REQUIRED');

  let stored: StoredVideo;
  try {
    stored = await uploadVideo(req.file.buffer, req.file.originalname, req.file.mimetype);
  } catch (error) {
    logger.error('Video upload failed', error);
    throw error instanceof ApiError
      ? error
      : new ApiError(502, 'Video upload failed. Please try again.', 'UPLOAD_FAILED');
  }

  res.status(201).json({
    success: true,
    message: 'VIDEO UPLOADED SUCCESSFULLY',
    upload: {
      videoUrl: stored.videoUrl,
      videoPublicId: stored.videoPublicId,
      storageProvider: stored.storageProvider,
      format: stored.format,
      bytes: stored.bytes,
      uploadToken: signUploadToken(
        req.admin!.id,
        stored.videoUrl,
        stored.videoPublicId,
        stored.storageProvider
      ),
    },
  });
});

/**
 * POST /api/clues — step 2: persist the clue and generate its unique 5-char code.
 * Accepts the staged JSON body, or a direct multipart upload in one call.
 */
export const createClue = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateClueInput;
  const adminId = req.admin!.id;

  let staged: StagedVideo;
  let justUploaded = false;

  if (req.file) {
    const stored = await uploadVideo(req.file.buffer, req.file.originalname, req.file.mimetype);
    staged = {
      videoUrl: stored.videoUrl,
      videoPublicId: stored.videoPublicId,
      storageProvider: stored.storageProvider,
    };
    justUploaded = true;
  } else if (body.uploadToken) {
    staged = resolveStagedVideoFromToken(body.uploadToken, adminId);
  } else {
    throw ApiError.badRequest('A video is required to create a clue.', 'VIDEO_REQUIRED');
  }

  try {
    const clue = await createClueWithUniqueCode({
      title: body.title,
      description: body.description ?? '',
      videoUrl: staged.videoUrl,
      videoPublicId: staged.videoPublicId,
      storageProvider: staged.storageProvider,
      createdBy: adminId,
    });

    res.status(201).json({
      success: true,
      message: 'CLUE CREATED SUCCESSFULLY',
      clue: toAdminClue(clue),
    });
  } catch (error) {
    // Never leave an orphaned asset in storage when the clue could not be saved.
    if (justUploaded) await deleteVideo(staged.videoPublicId, staged.storageProvider).catch(() => undefined);
    throw error;
  }
});

/** GET /api/clues — admin listing with filters + dashboard statistics. */
export const listClues = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, status } = req.query as unknown as ListCluesInput;

  const filter: Record<string, unknown> = {};
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;
  if (search) {
    // Escaped so user input can never act as a RegExp (ReDoS / pattern injection).
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ title: { $regex: safe, $options: 'i' } }, { code: { $regex: safe, $options: 'i' } }];
  }

  const [clues, total, totalClues, activeClues, inactiveClues] = await Promise.all([
    Clue.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Clue.countDocuments(filter),
    Clue.countDocuments({}),
    Clue.countDocuments({ isActive: true }),
    Clue.countDocuments({ isActive: false }),
  ]);

  res.json({
    success: true,
    clues: clues.map(toAdminClue),
    stats: {
      totalClues,
      activeClues,
      inactiveClues,
      // Every clue owns exactly one generated code, so the counts line up by design.
      generatedCodes: totalClues,
    },
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
});

/** GET /api/clues/:id */
export const getClue = asyncHandler(async (req: Request, res: Response) => {
  const clue = await Clue.findById(req.params.id);
  if (!clue) throw ApiError.notFound('Clue not found.', 'CLUE_NOT_FOUND');
  res.json({ success: true, clue: toAdminClue(clue) });
});

/** PATCH /api/clues/:id/status — enable / disable a clue. */
export const updateClueStatus = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = req.body as { isActive: boolean };
  const clue = await Clue.findByIdAndUpdate(req.params.id, { $set: { isActive } }, { new: true, runValidators: true });
  if (!clue) throw ApiError.notFound('Clue not found.', 'CLUE_NOT_FOUND');

  res.json({
    success: true,
    message: isActive ? 'Clue enabled.' : 'Clue disabled.',
    clue: toAdminClue(clue),
  });
});

/** DELETE /api/clues/:id — removes the document and the stored video. */
export const deleteClue = asyncHandler(async (req: Request, res: Response) => {
  const clue = await Clue.findByIdAndDelete(req.params.id);
  if (!clue) throw ApiError.notFound('Clue not found.', 'CLUE_NOT_FOUND');
  await deleteVideo(clue.videoPublicId, clue.storageProvider);
  res.json({ success: true, message: 'Clue deleted.', id: String(clue._id) });
});

// ─────────────────────────────────────────────────────────────────────────────
// Public endpoints
// ─────────────────────────────────────────────────────────────────────────────

const readStreamToken = (token: unknown): StreamTokenPayload => {
  if (typeof token !== 'string' || token.length === 0) {
    throw ApiError.unauthorized('Playback token is missing.', 'STREAM_TOKEN_MISSING');
  }
  try {
    return verifyToken<StreamTokenPayload>(token, { expectedType: 'stream' });
  } catch {
    throw ApiError.unauthorized('This playback link has expired. Please enter your code again.', 'STREAM_TOKEN_INVALID');
  }
};

/**
 * POST /api/clues/verify — public code check.
 * Returns only what the player needs; no database ids, storage ids or admin data.
 */
export const verifyCode = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  const normalized = code.trim().toUpperCase();

  const clue = await Clue.findOne({ code: normalized });

  // Never reveal which character was wrong — one generic message for every miss.
  if (!clue) throw ApiError.notFound('Invalid Code. No clue found.', 'INVALID_CODE');
  if (!clue.isActive) {
    throw new ApiError(403, 'This clue is currently unavailable.', 'CLUE_UNAVAILABLE');
  }

  const streamToken = signStreamToken(String(clue._id));

  res.json({
    success: true,
    message: 'CLUE UNLOCKED',
    clue: {
      id: String(clue._id),
      title: clue.title,
      description: clue.description ?? '',
      videoUrl: resolvePlaybackUrl(clue.videoUrl, clue.videoPublicId, clue.storageProvider),
      // Preferred playback source: token-gated, so the storage URL is never public.
      streamUrl: `/api/clues/${clue._id}/stream?token=${encodeURIComponent(streamToken)}`,
      expiresIn: STREAM_TOKEN_TTL_SECONDS,
    },
  });
});

/**
 * GET /api/clues/:id/stream?token=… — short-lived playback grant.
 * Redirects to the storage asset; disabling a clue immediately kills playback.
 */
export const streamClue = asyncHandler(async (req: Request, res: Response) => {
  const payload = readStreamToken(req.query.token);
  if (payload.sub !== req.params.id) {
    throw ApiError.forbidden('This playback link does not belong to that clue.', 'STREAM_TOKEN_MISMATCH');
  }

  const clue = await Clue.findById(payload.sub);
  if (!clue) throw ApiError.notFound('Clue not found.', 'CLUE_NOT_FOUND');
  if (!clue.isActive) throw new ApiError(403, 'This clue is currently unavailable.', 'CLUE_UNAVAILABLE');

  if (clue.storageProvider === 'local') {
    res.redirect(
      302,
      `/api/media/${encodeURIComponent(clue.videoPublicId)}?token=${encodeURIComponent(req.query.token as string)}`
    );
    return;
  }

  res.redirect(302, resolvePlaybackUrl(clue.videoUrl, clue.videoPublicId, clue.storageProvider));
});

/**
 * GET /api/media/:publicId?token=… — local-provider delivery with HTTP range support.
 * Only used when Cloudinary is not configured (development).
 */
export const serveLocalMedia = asyncHandler(
  async (req: Request, res: Response, next: (error?: unknown) => void) => {
    if (storageProviderName() === 'cloudinary') throw ApiError.notFound('Media not found.', 'MEDIA_NOT_FOUND');

    const payload = readStreamToken(req.query.token);
    const clue = await Clue.findById(payload.sub);
    if (!clue) throw ApiError.notFound('Clue not found.', 'CLUE_NOT_FOUND');
    if (!clue.isActive) throw new ApiError(403, 'This clue is currently unavailable.', 'CLUE_UNAVAILABLE');
    if (clue.videoPublicId !== req.params.publicId) {
      throw ApiError.forbidden('Playback link does not match this file.', 'MEDIA_MISMATCH');
    }

    const filePath = localFilePath(clue.videoPublicId);
    if (!fs.existsSync(filePath)) {
      logger.error('Stored video file is missing on disk', { publicId: clue.videoPublicId });
      throw ApiError.notFound('Video file is unavailable.', 'VIDEO_MISSING');
    }

    // sendFile handles Range requests, so seeking works in every browser.
    res.type(mimeForPublicId(clue.videoPublicId));
    res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        logger.error('Failed to stream stored video', error);
        next(error);
      }
    });
  }
);