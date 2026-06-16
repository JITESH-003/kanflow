import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';

const memberInclude = {
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
} as const;

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateWorkspace(userId: string) {
    const existing = await this.prisma.workspace.findFirst({ where: { ownerId: userId } });
    if (existing) return existing;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return this.prisma.workspace.create({
      data: { name: `${user?.name ?? 'My'} Workspace`, ownerId: userId },
    });
  }

  async createTeam(userId: string, dto: CreateTeamDto) {
    const workspace = await this.getOrCreateWorkspace(userId);
    return this.prisma.team.create({
      data: {
        name: dto.name,
        workspaceId: workspace.id,
        members: { create: { userId, role: 'admin' } },
      },
      include: { _count: { select: { members: true } } },
    });
  }

  async listTeams(userId: string) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: { team: { include: { _count: { select: { members: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      workspaceId: m.team.workspaceId,
      role: m.role,
      memberCount: m.team._count.members,
      createdAt: m.team.createdAt,
    }));
  }

  async getTeam(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: { include: memberInclude, orderBy: { createdAt: 'asc' } } },
    });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  listMembers(teamId: string) {
    return this.prisma.teamMember.findMany({
      where: { teamId },
      include: memberInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(teamId: string, dto: AddMemberDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException('No user found with that email');
    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: user.id } },
    });
    if (existing) throw new ConflictException('User is already a member of this team');
    return this.prisma.teamMember.create({
      data: { teamId, userId: user.id, role: dto.role },
      include: memberInclude,
    });
  }

  async updateMemberRole(teamId: string, userId: string, role: Role) {
    await this.ensureMember(teamId, userId);
    return this.prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { role },
      include: memberInclude,
    });
  }

  async removeMember(teamId: string, userId: string) {
    await this.ensureMember(teamId, userId);
    await this.prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
    return { success: true };
  }

  private async ensureMember(teamId: string, userId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found in this team');
  }
}
