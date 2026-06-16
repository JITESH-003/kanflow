import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../teams/rbac/roles.decorator';
import { TeamRolesGuard } from '../teams/rbac/team-roles.guard';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowService } from './workflow.service';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(private readonly workflows: WorkflowService) {}

  @Get(':id/workflow')
  @UseGuards(TeamRolesGuard)
  get(@Param('id') teamId: string) {
    return this.workflows.getOrCreateForTeam(teamId);
  }

  @Put(':id/workflow')
  @UseGuards(TeamRolesGuard)
  @Roles('admin', 'manager')
  update(@Param('id') teamId: string, @Body() dto: UpdateWorkflowDto) {
    return this.workflows.update(teamId, dto);
  }
}
