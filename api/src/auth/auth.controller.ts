import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Response } from 'express';
import { config } from '../common/env';
import { SESSION_COOKIE, SESSION_DAYS, createSessionToken } from '../common/session';
import { AuthGuard, CurrentUser } from './auth.guard';
import { AuthService, UserView, toUserView } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Public settings the website needs before login. */
  @Get('config')
  getConfig(): { liffId: string; devLogin: boolean } {
    const cfg = config();
    return { liffId: cfg.liffId, devLogin: Boolean(cfg.devLoginLineUserId) };
  }

  /** Exchange a LIFF ID token for a session cookie. */
  @Post('line')
  @HttpCode(200)
  async loginWithLine(@Body() body: { idToken?: unknown }, @Res({ passthrough: true }) res: Response): Promise<UserView> {
    if (typeof body?.idToken !== 'string' || !body.idToken) throw new BadRequestException('idToken is required');
    const profile = await this.auth.verifyLineIdToken(body.idToken);
    const user = await this.auth.upsertAllowedUser(profile.lineUserId, profile.name, profile.picture);
    this.setSession(res, user);
    return toUserView(user);
  }

  /** Local development only: log in without LINE. */
  @Post('dev')
  @HttpCode(200)
  async devLogin(@Res({ passthrough: true }) res: Response): Promise<UserView> {
    const id = config().devLoginLineUserId;
    if (!id) throw new ForbiddenException('Dev login is disabled');
    const user = await this.auth.upsertAllowedUser(id, 'Dev (local)', null);
    this.setSession(res, user);
    return toUserView(user);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: User): UserView {
    return toUserView(user);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  private setSession(res: Response, user: User): void {
    const cfg = config();
    res.cookie(SESSION_COOKIE, createSessionToken(user.id, cfg.sessionSecret), {
      httpOnly: true,
      secure: cfg.isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DAYS * 86_400_000,
    });
  }
}
