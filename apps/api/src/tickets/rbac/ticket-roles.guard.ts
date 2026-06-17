import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../../teams/rbac/roles.decorator';

@Injectable()
export class TicketRolesGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;
    if (!userId) {
      throw new ForbiddenException('Not authenticated');
    }

    let teamId: string | undefined;
    const ticketId: string | undefined = request.params?.id;
    if (ticketId) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { teamId: true },
      });
      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }
      teamId = ticket.teamId;
    } else if (request.body?.teamId) {
      teamId = request.body.teamId;
    }

    if (!teamId) {
      throw new ForbiddenException('Could not resolve the team for this request');
    }

    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this team');
    }
    request.membership = membership;

    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Your role does not permit this action');
    }

    return true;
  }
}
