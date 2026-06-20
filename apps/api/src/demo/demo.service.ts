import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { seedDemo } from './demo.seed';

@Injectable()
export class DemoService {
  private running: ReturnType<typeof seedDemo> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  reset() {
    if (!this.running) {
      this.running = seedDemo(this.prisma as never).finally(() => {
        this.running = null;
      }) as ReturnType<typeof seedDemo>;
    }
    return this.running;
  }
}
