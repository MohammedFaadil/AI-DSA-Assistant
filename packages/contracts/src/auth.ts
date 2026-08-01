import { z } from 'zod';
import { LanguageSchema, AssistModeSchema, RoleSchema, SkillLevelSchema } from './common.js';

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a number');

export const UsernameSchema = z
  .string()
  .min(3)
  .max(24)
  .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only');

export const RegisterSchema = z.object({
  email: z.string().email().max(255),
  username: UsernameSchema,
  password: PasswordSchema,
  name: z.string().min(1).max(80).optional(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({ email: z.string().email() });
export const ResetPasswordSchema = z.object({
  token: z.string().min(10),
  password: PasswordSchema,
});
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: PasswordSchema,
});
export const VerifyEmailSchema = z.object({ token: z.string().min(10) });

export const UserSettingsSchema = z.object({
  defaultLanguage: LanguageSchema,
  defaultAssistMode: AssistModeSchema,
  editorTheme: z.enum(['DARK', 'LIGHT', 'SYSTEM']),
  editorFontSize: z.number().int().min(10).max(28),
  editorTabSize: z.number().int().min(2).max(8),
  showGhostText: z.boolean(),
  showInlineHints: z.boolean(),
  proactiveMentor: z.boolean(),
  idleThresholdSec: z.number().int().min(10).max(300),
  emailNotify: z.boolean(),
  publicProfile: z.boolean(),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const UpdateSettingsSchema = UserSettingsSchema.partial();

export const PublicUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  country: z.string().nullable(),
  skillLevel: SkillLevelSchema,
  createdAt: z.string(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const SessionUserSchema = PublicUserSchema.extend({
  email: z.string(),
  role: RoleSchema,
  emailVerified: z.boolean(),
  settings: UserSettingsSchema,
  stats: z
    .object({
      totalSolved: z.number().int(),
      easySolved: z.number().int(),
      mediumSolved: z.number().int(),
      hardSolved: z.number().int(),
      xp: z.number().int(),
      globalRank: z.number().int().nullable(),
    })
    .nullable(),
  streak: z
    .object({ current: z.number().int(), longest: z.number().int() })
    .nullable(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
  user: SessionUserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const DeviceSessionSchema = z.object({
  id: z.string(),
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string(),
  current: z.boolean(),
});
export type DeviceSession = z.infer<typeof DeviceSessionSchema>;
