import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, Prisma } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WorkflowService } from '../workflow/workflow.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

const USER_SELECT = { select: { id: true, name: true, email: true, avatarUrl: true } };
const STAGE_SELECT = {
  select: { id: true, name: true, slug: true, position: true, isInitial: true },
};

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflows: WorkflowService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  private async addWatcher(ticketId: string, userId: string) {
    await this.prisma.watcher.upsert({
      where: { ticketId_userId: { ticketId, userId } },
      create: { ticketId, userId },
      update: {},
    });
  }

  private log(
    ticketId: string,
    actorId: string,
    action: ActivityAction,
    payload?: Prisma.InputJsonValue,
  ) {
    return this.prisma.activityLog.create({
      data: { ticketId, actorId, action, payload },
    });
  }

  listForTeam(teamId: string) {
    return this.prisma.ticket.findMany({
      where: { teamId },
      include: {
        stage: STAGE_SELECT,
        assignees: { include: { user: USER_SELECT } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listMine(userId: string, filter: 'assigned' | 'created') {
    const where =
      filter === 'created'
        ? { creatorId: userId }
        : { assignees: { some: { userId } } };
    return this.prisma.ticket.findMany({
      where,
      include: {
        stage: STAGE_SELECT,
        team: { select: { id: true, name: true } },
        assignees: { include: { user: USER_SELECT } },
        _count: { select: { comments: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOne(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        stage: STAGE_SELECT,
        creator: USER_SELECT,
        assignees: { include: { user: USER_SELECT } },
        comments: {
          include: {
            author: USER_SELECT,
            attachments: {
              include: { uploadedBy: { select: { id: true, name: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          where: { commentId: null },
          include: { uploadedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        activities: { include: { actor: USER_SELECT }, orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async create(userId: string, dto: CreateTicketDto) {
    const workflow = await this.workflows.getOrCreateForTeam(dto.teamId);
    const initial = workflow.stages.find((s) => s.isInitial) ?? workflow.stages[0];
    if (!initial) throw new BadRequestException('This team has no workflow stages yet');

    const assigneeIds = [...new Set(dto.assigneeIds ?? [])];
    if (assigneeIds.length) {
      const memberCount = await this.prisma.teamMember.count({
        where: { teamId: dto.teamId, userId: { in: assigneeIds } },
      });
      if (memberCount !== assigneeIds.length) {
        throw new BadRequestException('One or more assignees are not members of this team');
      }
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        teamId: dto.teamId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'medium',
        effort: dto.effort,
        etaAt: dto.etaAt ? new Date(dto.etaAt) : undefined,
        stageId: initial.id,
        creatorId: userId,
      },
    });
    await this.addWatcher(ticket.id, userId);
    await this.log(ticket.id, userId, 'ticket_created', { title: ticket.title });

    for (const targetId of assigneeIds) {
      await this.prisma.ticketAssignee.create({ data: { ticketId: ticket.id, userId: targetId } });
      await this.addWatcher(ticket.id, targetId);
      await this.log(ticket.id, userId, 'assignee_added', { userId: targetId });
      await this.notifications.notifyUser(targetId, userId, ticket.id, 'assigned', {
        ticketTitle: ticket.title,
      });
    }

    const created = await this.getOne(ticket.id);
    this.realtime.emitToBoard(dto.teamId, 'ticket:created', created);
    return created;
  }

  async update(ticketId: string, userId: string, dto: UpdateTicketDto) {
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        effort: dto.effort,
        etaAt: dto.etaAt ? new Date(dto.etaAt) : undefined,
      },
    });
    await this.log(ticketId, userId, 'ticket_updated', { fields: Object.keys(dto) });

    const updated = await this.getOne(ticketId);
    this.realtime.emitToBoard(updated.teamId, 'ticket:updated', updated);
    this.realtime.emitToTicket(ticketId, 'ticket:updated', updated);
    return updated;
  }

  async move(ticketId: string, userId: string, stageId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { stage: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const stage = await this.prisma.workflowStage.findUnique({
      where: { id: stageId },
      include: { workflow: true },
    });
    if (!stage || stage.workflow.teamId !== ticket.teamId) {
      throw new BadRequestException('That stage does not belong to this team');
    }
    if (stage.id === ticket.stageId) return this.getOne(ticketId);

    await this.prisma.ticket.update({ where: { id: ticketId }, data: { stageId } });
    await this.log(ticketId, userId, 'stage_changed', {
      fromStageId: ticket.stageId,
      toStageId: stage.id,
      from: ticket.stage?.name ?? null,
      to: stage.name,
    });

    const moved = await this.getOne(ticketId);
    this.realtime.emitToBoard(moved.teamId, 'ticket:moved', moved);
    this.realtime.emitToTicket(ticketId, 'ticket:updated', moved);
    await this.notifications.notifyWatchers(ticketId, userId, 'stage_changed', {
      ticketTitle: ticket.title,
      from: ticket.stage?.name ?? null,
      to: stage.name,
    });
    return moved;
  }

  async addAssignee(ticketId: string, actorId: string, targetUserId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: ticket.teamId, userId: targetUserId } },
    });
    if (!member) throw new BadRequestException('That user is not a member of this team');

    const existing = await this.prisma.ticketAssignee.findUnique({
      where: { ticketId_userId: { ticketId, userId: targetUserId } },
    });
    if (!existing) {
      await this.prisma.ticketAssignee.create({ data: { ticketId, userId: targetUserId } });
      await this.addWatcher(ticketId, targetUserId);
      await this.log(ticketId, actorId, 'assignee_added', { userId: targetUserId });
      await this.notifications.notifyUser(targetUserId, actorId, ticketId, 'assigned', {
        ticketTitle: ticket.title,
      });
    }

    const result = await this.getOne(ticketId);
    this.realtime.emitToBoard(result.teamId, 'ticket:assigned', result);
    this.realtime.emitToTicket(ticketId, 'ticket:assigned', result);
    return result;
  }

  async removeAssignee(ticketId: string, actorId: string, targetUserId: string) {
    const existing = await this.prisma.ticketAssignee.findUnique({
      where: { ticketId_userId: { ticketId, userId: targetUserId } },
    });
    if (existing) {
      await this.prisma.ticketAssignee.delete({
        where: { ticketId_userId: { ticketId, userId: targetUserId } },
      });
      await this.log(ticketId, actorId, 'assignee_removed', { userId: targetUserId });
    }

    const result = await this.getOne(ticketId);
    this.realtime.emitToBoard(result.teamId, 'ticket:assigned', result);
    this.realtime.emitToTicket(ticketId, 'ticket:assigned', result);
    return result;
  }

  listComments(ticketId: string) {
    return this.prisma.comment.findMany({
      where: { ticketId },
      include: {
        author: USER_SELECT,
        attachments: { include: { uploadedBy: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(ticketId: string, authorId: string, body: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const comment = await this.prisma.comment.create({
      data: { ticketId, authorId, body },
      include: {
        author: USER_SELECT,
        attachments: { include: { uploadedBy: { select: { id: true, name: true } } } },
      },
    });
    await this.addWatcher(ticketId, authorId);
    await this.log(ticketId, authorId, 'comment_added');

    this.realtime.emitToTicket(ticketId, 'comment:added', comment);
    this.realtime.emitToBoard(ticket.teamId, 'ticket:updated', { id: ticketId });
    await this.notifications.notifyWatchers(ticketId, authorId, 'comment_added', {
      ticketTitle: ticket.title,
    });
    return comment;
  }
}
