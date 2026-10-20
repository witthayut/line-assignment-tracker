import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { config } from '../common/env';
import { SESSION_COOKIE, readCookie, verifySessionToken } from '../common/session';
import { PrismaService } from '../prisma/prisma.service';

export type AuthedRequest = Request & { user?: User };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const payload = verifySessionToken(readCookie(req.headers.cookie, SESSION_COOKIE), config().sessionSecret);
    if (!payload) throw new UnauthorizedException('Please log in');
    const user = await this.prisma.user.findUnique({ where: { id: payload.uid } });
    if (!user) throw new UnauthorizedException('Please log in');
    req.user = user;
    return true;
  }
}

/** Use in a guarded controller: `@CurrentUser() user: User` */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.user) throw new UnauthorizedException('Please log in');
  return req.user;
});
