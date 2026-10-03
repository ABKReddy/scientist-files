import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export interface StoredVideo {
  /** URL persisted on the clue document (never sent straight to participants). */
  videoUrl: string;
  /** Handle used to delete the asset later. */
  videoPublicId: string;
  storageProvider: 'cloudinary' | 'local';
  bytes: number;
  format: string;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
};

const MIME_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm',
  ogv: 'video/ogg',
};

export const ALLOWED_VIDEO_MIME_TYPES = Object.keys(EXTENSION_BY_MIME);

const cloudinaryConfigured =
  env.storage.provider === 'cloudinary' &&
  Boolean(env.storage.cloudinary.cloudName && env.storage.cloudinary.apiKey && env.storage.cloudinary.apiSecret);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.storage.cloudinary.cloudName,
    api_key: env.storage.cloudinary.apiKey,
    api_secret: env.storage.cloudinary.apiSecret,
    secure: true,
  });
}

/** Identifies the real container from magic bytes — never trust the client's MIME type. */
export const detectVideoFormat = (buffer: Buffer): { format: string; mime: string } | null => {
  if (buffer.length < 12) return null;

  // ISO base media container: MP4 / MOV
  if (buffer.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buffer.toString('latin1', 8, 12);
    return brand === 'qt  ' ? { format: 'mov', mime: 'video/quicktime' } : { format: 'mp4', mime: 'video/mp4' };
  }
  // Matroska / WebM
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return { format: 'webm', mime: 'video/webm' };
  }
  // Ogg
  if (buffer.toString('latin1', 0, 4) === 'OggS') return { format: 'ogv', mime: 'video/ogg' };

  return null;
};

export const assertSupportedVideo = (
  buffer: Buffer,
  declaredMime: string
): { format: string; mime: string } => {
  const sniffed = detectVideoFormat(buffer);
  if (!sniffed) {
    throw ApiError.badRequest(
      'Unsupported video file. Please upload an MP4, WebM or MOV file.',
      'INVALID_VIDEO_FORMAT'
    );
  }
  const declared = EXTENSION_BY_MIME[declaredMime];
  if (declared && declared !== sniffed.format) {
    logger.warn('Declared MIME type does not match the file signature', {
      declaredMime,
      sniffed: sniffed.format,
    });
  }
  return sniffed;
};

const ensureLocalDir = async (): Promise<string> => {
  const dir = env.storage.localUploadDir;
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

const sanitizeFileName = (name: string): string =>
  path
    .basename(name || 'video')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(-64) || 'video';

const uploadToCloudinary = async (buffer: Buffer): Promise<StoredVideo> => {
  const publicId = `clue-${Date.now()}-${randomBytes(6).toString('hex')}`;
  try {
    const result: UploadApiResponse = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: env.storage.cloudinary.folder,
          public_id: publicId,
          overwrite: false,
          // Authenticated assets are delivered through short-lived signed URLs,
          // so the raw CDN address is never usable without going through our API.
          type: 'authenticated',
          use_filename: false,
          unique_filename: false,
        },
        (error, uploaded) => {
          if (error) reject(error);
          else if (uploaded) resolve(uploaded);
          else reject(new Error('Cloudinary returned an empty response'));
        }
      );
      stream.end(buffer);
    });

    return {
      videoUrl: result.secure_url,
      videoPublicId: result.public_id,
      storageProvider: 'cloudinary',
      bytes: result.bytes,
      format: result.format,
    };
  } catch (error) {
    logger.error('Cloudinary upload failed', error);
    throw new ApiError(502, 'Video upload failed. Please try again.', 'STORAGE_UPLOAD_FAILED');
  }
};

const uploadToLocalDisk = async (
  buffer: Buffer,
  fileName: string,
  declaredMime: string
): Promise<StoredVideo> => {
  const dir = await ensureLocalDir();
  const { format } = assertSupportedVideo(buffer, declaredMime);
  const storedName = `${Date.now()}-${randomBytes(8).toString('hex')}.${format}`;
  await fs.writeFile(path.join(dir, storedName), buffer);
  return {
    videoUrl: `/api/media/${storedName}`,
    videoPublicId: storedName,
    storageProvider: 'local',
    bytes: buffer.length,
    format,
  };
};

/** Uploads a validated video buffer to the configured storage provider. */
export const uploadVideo = async (
  buffer: Buffer,
  fileName: string,
  declaredMime: string
): Promise<StoredVideo> => {
  if (buffer.length === 0) throw ApiError.badRequest('Uploaded file is empty.', 'EMPTY_FILE');
  if (cloudinaryConfigured) return uploadToCloudinary(buffer);
  return uploadToLocalDisk(buffer, sanitizeFileName(fileName), declaredMime);
};

const destroyFromCloudinary = async (videoPublicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(videoPublicId, {
      resource_type: 'video',
      type: 'authenticated',
      invalidate: true,
    });
  } catch (error) {
    logger.warn('Cloudinary delete failed (asset may already be gone)', { videoPublicId, error });
  }
};

const removeFromLocalDisk = async (videoPublicId: string): Promise<void> => {
  try {
    await fs.unlink(path.join(env.storage.localUploadDir, path.basename(videoPublicId)));
  } catch (error) {
    logger.warn('Local file delete failed (file may already be gone)', { videoPublicId, error });
  }
};

/** Best-effort removal of the stored asset when a clue is deleted. */
export const deleteVideo = async (
  videoPublicId: string,
  provider: 'cloudinary' | 'local'
): Promise<void> => {
  if (!videoPublicId) return;
  if (provider === 'local' || !cloudinaryConfigured) return removeFromLocalDisk(videoPublicId);
  return destroyFromCloudinary(videoPublicId);
};

export const localFilePath = (videoPublicId: string): string =>
  path.join(env.storage.localUploadDir, path.basename(videoPublicId));

export const mimeForPublicId = (videoPublicId: string): string => {
  const extension = path.extname(videoPublicId).replace('.', '').toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
};

const STREAM_URL_TTL_SECONDS = 60 * 60;

/**
 * Builds the URL the browser should actually use to play the file.
 *
 * - local provider: served through the token-gated media route
 * - Cloudinary: the asset is stored as `authenticated`, so the SDK generates a
 *   signed URL that expires. Raw CDN links are therefore useless on their own.
 */
export const resolvePlaybackUrl = (
  storedUrl: string,
  videoPublicId: string,
  provider: 'cloudinary' | 'local'
): string => {
  if (provider === 'local') return `/api/media/${videoPublicId}`;
  if (!cloudinaryConfigured) return storedUrl;

  const format = path.extname(new URL(storedUrl).pathname).replace('.', '') || undefined;
  return cloudinary.url(videoPublicId, {
    resource_type: 'video',
    type: 'authenticated',
    ...(format ? { format } : {}),
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + STREAM_URL_TTL_SECONDS,
  });
};

export const storageProviderName = (): 'cloudinary' | 'local' =>
  cloudinaryConfigured ? 'cloudinary' : 'local';