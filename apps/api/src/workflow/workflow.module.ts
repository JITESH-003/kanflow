import { Module } from '@nestjs/common';
import { TeamRolesGuard } from '../teams/rbac/team-roles.guard';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  controllers: [WorkflowController],
  providers: [WorkflowService, TeamRolesGuard],
  exports: [WorkflowService],
})
export class WorkflowModule {}
