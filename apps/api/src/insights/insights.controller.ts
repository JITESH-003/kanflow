import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeamRolesGuard } from '../teams/rbac/team-roles.guard';
import { InsightsService } from './insights.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('teams/:id/insights')
  @UseGuards(TeamRolesGuard)
  get(@Param('id') id: string) {
    return this.insights.getForTeam(id);
  }
}
