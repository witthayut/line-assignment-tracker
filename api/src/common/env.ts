import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Parse a .env file body. Existing process.env values win. */
export function parseEnv(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Load api/.env then the project-root .env (for local dev). */
export function loadEnvFiles(apiDir: string): void {
  for (const file of [join(apiDir, '.env'), join(apiDir, '..', '.env')]) {
    if (!existsSync(file)) continue;
    for (const [k, v] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

export interface AppConfig {
  isProd: boolean;
  port: number;
  webUrl: string;
  sessionSecret: string;
  allowedLineUserIds: string[];
  uploadDir: string;
  lineChannelSecret: string;
  lineChannelAccessToken: string;
  lineLoginChannelId: string;
  liffId: string;
  anthropicApiKey: string;
  anthropicModel: string;
  devLoginLineUserId: string | null;
}

let cached: AppConfig | null = null;

export function config(): AppConfig {
  if (cached) return cached;
  const env = process.env;
  const isProd = env.NODE_ENV === 'production';
  const sessionSecret = env.SESSION_SECRET ?? '';
  if (isProd && sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters');
  }
  cached = {
    isProd,
    port: Number(env.PORT ?? 3000),
    webUrl: (env.WEB_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
    sessionSecret: sessionSecret || 'dev-only-insecure-secret',
    allowedLineUserIds: (env.ALLOWED_LINE_USER_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    uploadDir: env.UPLOAD_DIR ?? './uploads',
    lineChannelSecret: env.LINE_CHANNEL_SECRET ?? '',
    lineChannelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
    lineLoginChannelId: env.LINE_LOGIN_CHANNEL_ID ?? '',
    liffId: env.LIFF_ID ?? '',
    anthropicApiKey: env.ANTHROPIC_API_KEY ?? '',
    anthropicModel: env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
    devLoginLineUserId: !isProd && env.DEV_LOGIN_LINE_USER_ID ? env.DEV_LOGIN_LINE_USER_ID : null,
  };
  return cached;
}

export function isAllowedLineUser(lineUserId: string): boolean {
  const cfg = config();
  if (cfg.devLoginLineUserId && lineUserId === cfg.devLoginLineUserId) return true;
  return cfg.allowedLineUserIds.includes(lineUserId);
}
