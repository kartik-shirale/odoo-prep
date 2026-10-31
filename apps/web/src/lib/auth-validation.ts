import { z } from 'zod';
import { AUTH_LIMITS } from '@/constants/messages';
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));
export const passwordSchema = z.string().min(AUTH_LIMITS.PASSWORD_MIN, 'Use at least 8 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter').regex(/\d/, 'Include at least one number')
  .refine((value) => new TextEncoder().encode(value).length <= AUTH_LIMITS.PASSWORD_MAX_BYTES, 'Use at most 72 bytes');
export const confirmPasswords = (values: { password: string; confirmPassword: string }): boolean => values.password === values.confirmPassword;
export const confirmOptions = { message: 'Passwords do not match', path: ['confirmPassword'] };
