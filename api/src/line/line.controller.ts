import { Controller, Headers, HttpCode, Logger, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { config } from '../common/env';
import { BotService, LineEvent } from './bot.service';
import { verifyLineSignature } from './line-api';

@Controller('line')
export class LineController {
  private readonly log = new Logger('LineWebhook');

  constructor(private readonly bot: BotService) {}

  /** Webhook URL to set in LINE Developers Console: https://<your-domain>/api/line/webhook */
  @Post('webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-line-signature') signature?: string): { ok: true } {
    const raw = req.rawBody;
    if (!raw || !verifyLineSignature(raw, signature, config().lineChannelSecret)) {
      this.log.warn('Rejected webhook with a bad signature');
      throw new UnauthorizedException('Bad signature');
    }
    const events = ((req.body as { events?: LineEvent[] })?.events ?? []) as LineEvent[];
    // Answer LINE right away; do the slow AI work in the background.
    void this.bot.handleEvents(events);
    return { ok: true };
  }
}
