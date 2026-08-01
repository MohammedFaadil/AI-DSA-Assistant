import { randomUUID } from 'node:crypto';
import { Prisma, prisma } from '@repo/db';
import type { AuthResponse, LoginInput, RegisterInput, SessionUser } from '@repo/contracts';
import { conflict, forbidden, notFound, tokenReused, unauthenticated } from '../../lib/errors.js';
import { generateRefreshToken, hashToken, signAccessToken } from '../../lib/jwt.js';
import { hashPassword, needsRehash, verifyPassword } from '../../lib/password.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { redis } from '../../lib/redis.js';

export interface DeviceInfo {
  userAgent?: string;
  ipAddress?: string;
}

const USER_INCLUDE = {
  settings: true,
  stats: true,
  streak: true,
} satisfies Prisma.UserInclude;

type UserWithRelations = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

export function toSessionUser(user: UserWithRelations): SessionUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    country: user.country,
    skillLevel: user.skillLevel,
    createdAt: user.createdAt.toISOString(),
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
    settings: {
      defaultLanguage: user.settings?.defaultLanguage ?? 'PYTHON',
      defaultAssistMode: user.settings?.defaultAssistMode ?? 'MODERATE',
      editorTheme: user.settings?.editorTheme ?? 'DARK',
      editorFontSize: user.settings?.editorFontSize ?? 14,
      editorTabSize: user.settings?.editorTabSize ?? 4,
      showGhostText: user.settings?.showGhostText ?? true,
      showInlineHints: user.settings?.showInlineHints ?? true,
      proactiveMentor: user.settings?.proactiveMentor ?? true,
      idleThresholdSec: user.settings?.idleThresholdSec ?? 45,
      emailNotify: user.settings?.emailNotify ?? true,
      publicProfile: user.settings?.publicProfile ?? true,
    },
    stats: user.stats
      ? {
          totalSolved: user.stats.totalSolved,
          easySolved: user.stats.easySolved,
          mediumSolved: user.stats.mediumSolved,
          hardSolved: user.stats.hardSolved,
          xp: user.stats.xp,
          globalRank: user.stats.globalRank,
        }
      : null,
    streak: user.streak ? { current: user.streak.current, longest: user.streak.longest } : null,
  };
}

async function issueTokens(
  userId: string,
  role: string,
  username: string,
  device: DeviceInfo,
  familyId: string = randomUUID(),
): Promise<{ accessToken: string; expiresIn: number; refreshToken: string }> {
  const { token: accessToken, expiresIn } = signAccessToken({ sub: userId, role, username });
  const { token: refreshToken, hash } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hash,
      familyId,
      userAgent: device.userAgent?.slice(0, 300),
      ipAddress: device.ipAddress?.slice(0, 45),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    },
  });

  return { accessToken, expiresIn, refreshToken };
}

/** Every new account gets its satellite rows in one transaction. */
async function provisionUser(userId: string, skillLevel: 'BEGINNER' = 'BEGINNER'): Promise<void> {
  await prisma.$transaction([
    prisma.userSettings.create({ data: { userId } }),
    prisma.learnerProfile.create({ data: { userId, skillLevel } }),
    prisma.userStats.create({ data: { userId } }),
    prisma.streak.create({ data: { userId } }),
  ]);
}

export async function register(
  input: RegisterInput,
  device: DeviceInfo,
): Promise<AuthResponse & { refreshToken: string }> {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
    select: { email: true, username: true },
  });
  if (existing) {
    if (existing.email.toLowerCase() === input.email.toLowerCase()) {
      throw conflict('An account with that email already exists.', 'EMAIL_TAKEN');
    }
    throw conflict('That username is taken.', 'USERNAME_TAKEN');
  }

  const passwordHash = await hashPassword(input.password);
  const created = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      name: input.name ?? input.username,
      passwordHash,
      // Email verification is a product decision, not a security gate here:
      // an unverified account can solve problems but not appear on the
      // leaderboard. Auto-verifying in dev keeps the loop fast.
      emailVerifiedAt: env.NODE_ENV === 'development' ? new Date() : null,
    },
  });
  await provisionUser(created.id);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: created.id },
    include: USER_INCLUDE,
  });
  const tokens = await issueTokens(user.id, user.role, user.username, device);

  logger.info({ userId: user.id }, 'user registered');
  return { ...tokens, user: toSessionUser(user) };
}

export async function login(
  input: LoginInput,
  device: DeviceInfo,
): Promise<AuthResponse & { refreshToken: string }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: USER_INCLUDE,
  });

  // Uniform failure for "no such user" and "wrong password" so the endpoint
  // cannot be used to enumerate accounts.
  const failure = unauthenticated('Incorrect email or password.');
  if (!user || !user.passwordHash || user.deletedAt) throw failure;
  if (!user.isActive) throw forbidden('This account has been suspended.');

  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw failure;

  if (needsRehash(user.passwordHash)) {
    const upgraded = await hashPassword(input.password);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: upgraded } });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
  const tokens = await issueTokens(user.id, user.role, user.username, device);
  return { ...tokens, user: toSessionUser(user) };
}

/**
 * Rotate a refresh token.
 *
 * Reuse detection: a token that has already been rotated (revokedAt set) means
 * either the user's token was stolen and replayed, or ours was. Either way the
 * safe response is to revoke the entire family, which logs out the attacker and
 * the victim and forces a fresh login.
 */
export async function refresh(
  rawToken: string,
  device: DeviceInfo,
): Promise<AuthResponse & { refreshToken: string }> {
  const hash = hashToken(rawToken);
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
    include: { user: { include: USER_INCLUDE } },
  });

  if (!record) throw unauthenticated('Session not found. Please sign in again.');

  if (record.revokedAt || record.expiresAt < new Date()) {
    if (record.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await redis.set(`revoked:family:${record.familyId}`, '1', 30 * 86_400);
      logger.warn({ userId: record.userId, familyId: record.familyId }, 'refresh token reuse detected');
      throw tokenReused();
    }
    throw unauthenticated('Your session has expired. Please sign in again.');
  }

  if (!record.user.isActive || record.user.deletedAt) throw forbidden('This account is unavailable.');

  const tokens = await issueTokens(
    record.user.id,
    record.user.role,
    record.user.username,
    device,
    record.familyId,
  );
  const newHash = hashToken(tokens.refreshToken);
  const replacement = await prisma.refreshToken.findUniqueOrThrow({
    where: { tokenHash: newHash },
    select: { id: true },
  });

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date(), replacedById: replacement.id },
  });

  return { ...tokens, user: toSessionUser(record.user) };
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logoutAll(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function me(userId: string): Promise<SessionUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: USER_INCLUDE });
  if (!user || user.deletedAt) throw notFound('Account not found.');
  return toSessionUser(user);
}

export async function listDevices(userId: string, currentRaw?: string) {
  const currentHash = currentRaw ? hashToken(currentRaw) : null;
  const rows = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return rows.map((r) => ({
    id: r.id,
    userAgent: r.userAgent,
    ipAddress: r.ipAddress,
    createdAt: r.createdAt.toISOString(),
    current: currentHash !== null && r.tokenHash === currentHash,
  }));
}

export async function revokeDevice(userId: string, id: string): Promise<void> {
  const result = await prisma.refreshToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw notFound('Session not found.');
}

export async function changePassword(
  userId: string,
  current: string,
  next: string,
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) throw forbidden('This account signs in with a social provider.');
  if (!(await verifyPassword(user.passwordHash, current))) {
    throw unauthenticated('Current password is incorrect.');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(next) },
  });
  // Changing a password invalidates every other session — that is the point.
  await logoutAll(userId);
}
