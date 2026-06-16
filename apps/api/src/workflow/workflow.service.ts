import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

const DEFAULT_STAGES = [
  { name: 'Backlog', slug: 'backlog', position: 0, isInitial: true },
  { name: 'To Do', slug: 'to-do', position: 1, isInitial: false },
  { name: 'In Progress', slug: 'in-progress', position: 2, isInitial: false },
  { name: 'In Review', slug: 'in-review', position: 3, isInitial: false },
  { name: 'Done', slug: 'done', position: 4, isInitial: false },
];

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateForTeam(teamId: string) {
    const existing = await this.prisma.workflow.findUnique({
      where: { teamId },
      include: { stages: { orderBy: { position: 'asc' } }, rules: true },
    });
    if (existing) return existing;
    return this.prisma.workflow.create({
      data: { teamId, name: 'Default workflow', stages: { create: DEFAULT_STAGES } },
      include: { stages: { orderBy: { position: 'asc' } }, rules: true },
    });
  }

  async update(teamId: string, dto: UpdateWorkflowDto) {
    if (dto.stages.length === 0) {
      throw new BadRequestException('A workflow needs at least one stage');
    }
    if (dto.stages.filter((s) => s.isInitial).length !== 1) {
      throw new BadRequestException('Exactly one stage must be the initial stage');
    }
    const slugs = dto.stages.map((s) => s.slug);
    if (new Set(slugs).size !== slugs.length) {
      throw new BadRequestException('Stage slugs must be unique');
    }

    const workflow = await this.getOrCreateForTeam(teamId);
    const keepStageIds = dto.stages.map((s) => s.id).filter((id): id is string => Boolean(id));
    const keepRuleIds = dto.rules.map((r) => r.id).filter((id): id is string => Boolean(id));

    await this.prisma.$transaction(async (tx) => {
      await tx.workflowStage.deleteMany({
        where: {
          workflowId: workflow.id,
          id: { notIn: keepStageIds.length ? keepStageIds : ['__none__'] },
        },
      });
      await tx.workflowRule.deleteMany({
        where: {
          workflowId: workflow.id,
          id: { notIn: keepRuleIds.length ? keepRuleIds : ['__none__'] },
        },
      });

      for (let i = 0; i < dto.stages.length; i++) {
        const s = dto.stages[i];
        if (s.id) {
          await tx.workflowStage.update({
            where: { id: s.id },
            data: { name: s.name, slug: s.slug, position: i, isInitial: s.isInitial },
          });
        } else {
          await tx.workflowStage.create({
            data: {
              workflowId: workflow.id,
              name: s.name,
              slug: s.slug,
              position: i,
              isInitial: s.isInitial,
            },
          });
        }
      }

      for (const r of dto.rules) {
        if (r.id) {
          await tx.workflowRule.update({
            where: { id: r.id },
            data: { type: r.type, config: r.config as Prisma.InputJsonValue },
          });
        } else {
          await tx.workflowRule.create({
            data: {
              workflowId: workflow.id,
              type: r.type,
              config: r.config as Prisma.InputJsonValue,
            },
          });
        }
      }

      if (dto.name) {
        await tx.workflow.update({ where: { id: workflow.id }, data: { name: dto.name } });
      }
    });

    return this.prisma.workflow.findUnique({
      where: { id: workflow.id },
      include: { stages: { orderBy: { position: 'asc' } }, rules: true },
    });
  }

  isFieldLocked(
    rules: { type: string; config: unknown }[],
    field: string,
    stagePosition: number,
  ): boolean {
    const rule = rules.find(
      (r) => r.type === 'field_lock' && (r.config as { field?: string })?.field === field,
    );
    if (!rule) return false;
    const from = (rule.config as { lockedFromPosition?: number }).lockedFromPosition;
    return typeof from === 'number' && stagePosition >= from;
  }
}
