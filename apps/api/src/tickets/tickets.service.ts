import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

  async getOne(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        stage: STAGE_SELECT,
        creator: USER_SELECT,
        assignees: { include: { user: USER_SELECT } },
        comments: { include: { author: USER_SELECT }, orderBy: { createdAt: 'asc' } },
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
    return this.getOne(ticket.id);
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
    return this.getOne(ticketId);
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
      from: ticket.stage?.name ?? null,
      to: stage.name,
    });
    return this.getOne(ticketId);
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
    }
    return this.getOne(ticketId);
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
    return this.getOne(ticketId);
  }

  listComments(ticketId: string) {
    return this.prisma.comment.findMany({
      where: { ticketId },
      include: { author: USER_SELECT },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(ticketId: string, authorId: string, body: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const comment = await this.prisma.comment.create({
      data: { ticketId, authorId, body },
      include: { author: USER_SELECT },
    });
    await this.addWatcher(ticketId, authorId);
    await this.log(ticketId, authorId, 'comment_added');
    return comment;
  }
}
