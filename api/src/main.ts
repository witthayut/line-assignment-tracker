import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { loadEnvFiles, config } from './common/env';

async function bootstrap(): Promise<void> {
  loadEnvFiles(process.cwd()); // local dev: reads api/.env and ../.env
  const cfg = config();

  // Import after env is loaded
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  app.set('trust proxy', 1);
  app.enableShutdownHooks();

  const missing = [
    ['LINE_CHANNEL_SECRET', cfg.lineChannelSecret],
    ['LINE_CHANNEL_ACCESS_TOKEN', cfg.lineChannelAccessToken],
    ['LINE_LOGIN_CHANNEL_ID', cfg.lineLoginChannelId],
    ['LIFF_ID', cfg.liffId],
    ['ANTHROPIC_API_KEY', cfg.anthropicApiKey],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  const log = new Logger('Bootstrap');
  if (missing.length) log.warn(`Not set yet (LINE/AI features won't work): ${missing.join(', ')}`);
  if (!cfg.allowedLineUserIds.length) log.warn('ALLOWED_LINE_USER_IDS is empty — nobody can log in with LINE yet');
  if (cfg.devLoginLineUserId) log.log('Dev login is ON (local development only)');

  await app.listen(cfg.port, '0.0.0.0');
  log.log(`API running on http://localhost:${cfg.port}/api`);
}

void bootstrap();
