import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { config, isAllowedLineUser } from '../common/env';
import { PrismaService } from '../prisma/prisma.service';

export interface UserView {
  id: string;
  displayName: string;
  pictureUrl: string | null;
}

export function toUserView(u: User): UserView {
  return { id: u.id, displayName: u.displayName, pictureUrl: u.pictureUrl };
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Verify a LIFF / LINE Login ID token with LINE's server. Returns the LINE profile. */
  async verifyLineIdToken(idToken: string): Promise<{ lineUserId: string; name: string; picture: string | null }> {
    const cfg = config();
    if (!cfg.lineLoginChannelId) throw new UnauthorizedException('LINE_LOGIN_CHANNEL_ID is not configured');
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: cfg.lineLoginChannelId }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new UnauthorizedException('LINE login expired — please log in again');
    const data = (await res.json()) as { sub?: string; name?: string; picture?: string };
    if (!data.sub) throw new UnauthorizedException('LINE login failed');
    return { lineUserId: data.sub, name: data.name ?? 'LINE user', picture: data.picture ?? null };
  }

  /** Create or update the user. Only allowed LINE IDs get in. */
  async upsertAllowedUser(lineUserId: string, displayName: string, pictureUrl: string | null): Promise<User> {
    if (!isAllowedLineUser(lineUserId)) {
      throw new ForbiddenException(`This LINE account is not allowed. Add ${lineUserId} to ALLOWED_LINE_USER_IDS.`);
    }
    return this.prisma.user.upsert({
      where: { lineUserId },
      create: { lineUserId, displayName, pictureUrl },
      update: { displayName, pictureUrl },
    });
  }
}
