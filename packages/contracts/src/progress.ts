import { z } from 'zod';
import { DifficultySchema, SkillLevelSchema } from './common.js';

export const ProgressOverviewSchema = z.object({
  totalSolved: z.number().int(),
  totalProblems: z.number().int(),
  byDifficulty: z.record(DifficultySchema, z.object({
    solved: z.number().int(),
    total: z.number().int(),
  })),
  acceptanceRate: z.number(),
  totalSubmissions: z.number().int(),
  xp: z.number().int(),
  globalRank: z.number().int().nullable(),
  skillLevel: SkillLevelSchema,
  streak: z.object({ current: z.number().int(), longest: z.number().int() }),
  hintDependency: z.number(),
  confidence: z.number(),
});
export type ProgressOverview = z.infer<typeof ProgressOverviewSchema>;

export const HeatmapDaySchema = z.object({
  date: z.string(),
  solvedCount: z.number().int(),
  submissionCount: z.number().int(),
  activeMinutes: z.number().int(),
});
export const HeatmapResponseSchema = z.object({
  year: z.number().int(),
  days: z.array(HeatmapDaySchema),
  totalActiveDays: z.number().int(),
});

export const TopicMasterySchema = z.object({
  slug: z.string(),
  name: z.string(),
  mastery: z.number(),
  attempts: z.number().int(),
  solved: z.number().int(),
  avgHintsUsed: z.number(),
  lastPracticedAt: z.string().nullable(),
  decaying: z.boolean(),
});
export type TopicMasteryDto = z.infer<typeof TopicMasterySchema>;

export const AchievementSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']),
  progress: z.number(),
  earnedAt: z.string().nullable(),
  xpReward: z.number().int(),
});
export type Achievement = z.infer<typeof AchievementSchema>;

export const LeaderboardQuerySchema = z.object({
  scope: z.enum(['GLOBAL', 'WEEKLY', 'MONTHLY']).default('GLOBAL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const LeaderboardRowSchema = z.object({
  rank: z.number().int(),
  username: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  score: z.number().int(),
  solved: z.number().int(),
  isCurrentUser: z.boolean(),
});
export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;
