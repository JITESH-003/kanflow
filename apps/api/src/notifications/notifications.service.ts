import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private async create(
    recipientId: string,
    ticketId: string,
    kind: string,
    payload: Record<string, unknown>,
  ) {
    const notification = await this.prisma.notification.create({
      data: { recipientId, ticketId, kind, payload: payload as Prisma.InputJsonValue },
    });
    this.realtime.emitToUser(recipientId, 'notification:new', notification);
    return notification;
  }

  async notifyWatchers(
    ticketId: string,
    actorId: string,
    kind: string,
    payload: Record<string, unknown>,
  ) {
    const watchers = await this.prisma.watcher.findMany({
      where: { ticketId, userId: { not: actorId } },
    });
    await Promise.all(watchers.map((w) => this.create(w.userId, ticketId, kind, payload)));
  }

  async notifyUser(
    recipientId: string,
    actorId: string,
    ticketId: string,
    kind: string,
    payload: Record<string, unknown>,
  ) {
    if (recipientId === actorId) return;
    await this.create(recipientId, ticketId, kind, payload);
  }

  async list(userId: string) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.notification.count({ where: { recipientId: userId, readAt: null } }),
    ]);
    return { items, unread };
  }

  async markRead(id: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { id, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }
}
