import { randomInt, randomBytes } from 'crypto';

/** Unambiguous alphanumeric set used for clue codes. */
export const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const CODE_LENGTH = 5;

/**
 * Cryptographically secure random code generator.
 * Uses `crypto.randomInt` (rejection-sampling, unbiased) instead of Math.random.
 */
export const generateCode = (length: number = CODE_LENGTH): string => {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
};

export const isValidCodeFormat = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length !== CODE_LENGTH) return false;
  return /^[A-Za-z0-9]{5}$/.test(trimmed);
};

export const normalizeCode = (value: string): string => value.trim().toUpperCase();

/** Random, URL-safe token used for signed upload / streaming grants. */
export const generateRandomToken = (bytes = 24): string => randomBytes(bytes).toString('hex');