import { z } from 'zod';
import { CODE_LENGTH } from '../utils/codeGenerator';
import { sanitizeText } from '../utils/sanitize';

export const verifyCodeSchema = z.object({
  code: z
    .string({ required_error: 'Code is required.' })
    .trim()
    .toUpperCase()
    .regex(
      new RegExp(`^[A-Z0-9]{${CODE_LENGTH}}$`),
      `Code must be exactly ${CODE_LENGTH} letters or numbers.`
    ),
});

export const createClueSchema = z.object({
  title: z
    .string({ required_error: 'Clue title is required.' })
    .transform(sanitizeText)
    .pipe(z.string().min(2, 'Clue title must be at least 2 characters.').max(120, 'Clue title is too long.')),
  description: z
    .string()
    .optional()
    .default('')
    .transform((value) => sanitizeText(value ?? ''))
    .pipe(z.string().max(2000, 'Description is too long.')),
  /** Proof-of-upload returned by POST /api/clues/upload (staged flow). */
  uploadToken: z.string().min(10, 'Upload token is missing or invalid.').max(2000).optional(),
});

export const clueStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive must be a boolean.' }),
});

export const objectIdSchema = z.object({
  id: z.string({ required_error: 'Clue id is required.' }).regex(/^[a-fA-F0-9]{24}$/, 'Invalid clue id.'),
});

export const listCluesSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(100),
  search: z
    .string()
    .optional()
    .transform((value) => (value ? sanitizeText(value).slice(0, 120) : undefined)),
  status: z.enum(['all', 'active', 'inactive']).optional().default('all'),
});

export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type CreateClueInput = z.infer<typeof createClueSchema>;
export type ListCluesInput = z.infer<typeof listCluesSchema>;