import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class TeamRolesGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;
    const teamId: string | undefined = request.params?.id ?? request.params?.teamId;

    if (!userId || !teamId) {
      throw new ForbiddenException('Team access denied');
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
