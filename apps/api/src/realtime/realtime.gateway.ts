import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^https:\/\/kanflow[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  const list = (process.env.WEB_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(origin);
}

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) =>
      cb(null, isAllowedOrigin(origin)),
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly presence = new Map<string, Map<string, { name: string; count: number }>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('Missing token');
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true },
      });
      if (!user) throw new Error('Unknown user');
      client.data.userId = user.id;
      client.data.name = user.name;
      client.data.rooms = new Set<string>();
      client.join(`user:${user.id}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const rooms = client.data.rooms as Set<string> | undefined;
    const userId = client.data.userId as string | undefined;
    if (!rooms || !userId) return;
    for (const room of rooms) {
      this.removePresence(room, userId);
      this.emitPresence(room);
    }
  }

  private async isMember(teamId: string, userId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    return !!member;
  }

  private addPresence(room: string, userId: string, name: string) {
    let users = this.presence.get(room);
    if (!users) {
      users = new Map();
      this.presence.set(room, users);
    }
    const entry = users.get(userId);
    if (entry) entry.count += 1;
    else users.set(userId, { name, count: 1 });
  }

  private removePresence(room: string, userId: string) {
    const users = this.presence.get(room);
    const entry = users?.get(userId);
    if (!users || !entry) return;
    entry.count -= 1;
    if (entry.count <= 0) users.delete(userId);
    if (users.size === 0) this.presence.delete(room);
  }

  private emitPresence(room: string) {
    const users = this.presence.get(room);
    const list = users ? [...users.entries()].map(([id, v]) => ({ id, name: v.name })) : [];
    this.server.to(room).emit('presence:update', { room, users: list });
  }

  private leaveRoom(client: Socket, room: string) {
    const userId = client.data.userId as string;
    client.leave(room);
    (client.data.rooms as Set<string> | undefined)?.delete(room);
    this.removePresence(room, userId);
    this.emitPresence(room);
  }

  @SubscribeMessage('board:join')
  async boardJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { teamId: string }) {
    const userId = client.data.userId as string;
    if (!body?.teamId || !(await this.isMember(body.teamId, userId))) return;
    const room = `board:${body.teamId}`;
    client.join(room);
    (client.data.rooms as Set<string>).add(room);
    this.addPresence(room, userId, client.data.name as string);
    this.emitPresence(room);
  }

  @SubscribeMessage('board:leave')
  boardLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { teamId: string }) {
    if (body?.teamId) this.leaveRoom(client, `board:${body.teamId}`);
  }

  @SubscribeMessage('ticket:join')
  async ticketJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { ticketId: string }) {
    const userId = client.data.userId as string;
    if (!body?.ticketId) return;
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: body.ticketId },
      select: { teamId: true },
    });
    if (!ticket || !(await this.isMember(ticket.teamId, userId))) return;
    const room = `ticket:${body.ticketId}`;
    client.join(room);
    (client.data.rooms as Set<string>).add(room);
    this.addPresence(room, userId, client.data.name as string);
    this.emitPresence(room);
  }

  @SubscribeMessage('ticket:leave')
  ticketLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { ticketId: string }) {
    if (body?.ticketId) this.leaveRoom(client, `ticket:${body.ticketId}`);
  }

  emitToBoard(teamId: string, event: string, payload: unknown) {
    this.server.to(`board:${teamId}`).emit(event, payload);
  }

  emitToTicket(ticketId: string, event: string, payload: unknown) {
    this.server.to(`ticket:${ticketId}`).emit(event, payload);
  }
}
