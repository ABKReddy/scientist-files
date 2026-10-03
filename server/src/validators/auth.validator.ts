import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.')
    .max(200),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password is required.')
    .max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;