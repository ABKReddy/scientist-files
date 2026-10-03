import { generateCode } from '../utils/codeGenerator';

const MAX_ATTEMPTS = 25;

/**
 * Generates a unique 5-character clue code using a cryptographically secure RNG.
 *
 * Two layers of protection:
 *  1. Pre-check with `exists()` so we never bother the index with an obvious collision.
 *  2. The `code` field carries a unique MongoDB index — a racing request that slips
 *     past the pre-check is caught by duplicate-key error 11000 and retried here.
 */
export const generateUniqueCode = async (isTaken: (code: string) => Promise<boolean>): Promise<string> => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const candidate = generateCode();
    // eslint-disable-next-line no-await-in-loop
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error('Unable to generate a unique clue code.');
};

export const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: number }).code === 11000;

/** Maps a Mongo duplicate-key failure on `code` to a stable API error code. */
export const isCodeDuplicateKeyError = (error: unknown): boolean => {
  if (!isDuplicateKeyError(error)) return false;
  const keyPattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern;
  const keyValue = (error as { keyValue?: Record<string, unknown> }).keyValue;
  if (keyPattern && Object.prototype.hasOwnProperty.call(keyPattern, 'code')) return true;
  if (keyValue && Object.prototype.hasOwnProperty.call(keyValue, 'code')) return true;
  return false;
};