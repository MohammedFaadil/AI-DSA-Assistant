import { Router } from 'express';
import {
  ChangePasswordSchema,
  LoginSchema,
  RegisterSchema,
  UpdateSettingsSchema,
} from '@repo/contracts';
import { prisma } from '@repo/db';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { LIMITS, rateLimit } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { REFRESH_COOKIE, refreshCookieOptions } from '../../lib/jwt.js';
import { unauthenticated } from '../../lib/errors.js';
import * as auth from './auth.service.js';

export const authRouter = Router();

const device = (req: import('express').Request): auth.DeviceInfo => ({
  userAgent: req.header('user-agent') ?? undefined,
  ipAddress: req.ip,
});

authRouter.post(
  '/register',
  rateLimit(LIMITS.auth),
  validate(RegisterSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken, ...body } = await auth.register(req.body, device(req));
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.status(201).json(body);
  }),
);

authRouter.post(
  '/login',
  rateLimit(LIMITS.auth),
  validate(LoginSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken, ...body } = await auth.login(req.body, device(req));
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.json(body);
  }),
);

authRouter.post(
  '/refresh',
  rateLimit(LIMITS.auth),
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!raw) throw unauthenticated('No session cookie.');
    const { refreshToken, ...body } = await auth.refresh(raw, device(req));
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.json(body);
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await auth.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    res.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
    res.status(204).end();
  }),
);

authRouter.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req, res) => {
    await auth.logoutAll(req.auth!.userId);
    res.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
    res.status(204).end();
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await auth.me(req.auth!.userId));
  }),
);

authRouter.patch(
  '/me/settings',
  authenticate,
  rateLimit(LIMITS.write),
  validate(UpdateSettingsSchema),
  asyncHandler(async (req, res) => {
    await prisma.userSettings.update({ where: { userId: req.auth!.userId }, data: req.body });
    res.json(await auth.me(req.auth!.userId));
  }),
);

authRouter.post(
  '/change-password',
  authenticate,
  rateLimit(LIMITS.auth),
  validate(ChangePasswordSchema),
  asyncHandler(async (req, res) => {
    await auth.changePassword(req.auth!.userId, req.body.currentPassword, req.body.newPassword);
    res.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
    res.status(204).end();
  }),
);

authRouter.get(
  '/sessions',
  authenticate,
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    res.json({ items: await auth.listDevices(req.auth!.userId, raw) });
  }),
);

authRouter.delete(
  '/sessions/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    await auth.revokeDevice(req.auth!.userId, req.params.id!);
    res.status(204).end();
  }),
);
