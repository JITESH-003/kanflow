import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InsightsService } from './insights.service';

const SCAN_INTERVAL_MS = 10 * 60 * 1000;

@Injectable()
export class InsightsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('InsightsScheduler');
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(private readonly insights: InsightsService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), SCAN_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.insights.scanAll();
    } catch (e) {
      this.logger.warn(`aging scan failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.running = false;
    }
  }
}
