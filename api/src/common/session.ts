// Signed login session tokens (stored in an httpOnly cookie).
// Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SessionPayload {
  uid: string; // our User.id
  exp: number; // unix seconds
}

export const SESSION_COOKIE = 'reminder_session';
export const SESSION_DAYS = 30;

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function createSessionToken(uid: string, secret: string, now = Date.now()): string {
  const payload: SessionPayload = { uid, exp: Math.floor(now / 1000) + SESSION_DAYS * 86400 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): SessionPayload | null {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.uid !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 < now) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Minimal Cookie header parser. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}
