import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { TeamRolesGuard } from '../teams/rbac/team-roles.guard';
import { WorkflowModule } from '../workflow/workflow.module';
import { TicketRolesGuard } from './rbac/ticket-roles.guard';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [WorkflowModule, RealtimeModule],
  controllers: [TicketsController],
  providers: [TicketsService, TeamRolesGuard, TicketRolesGuard],
})
export class TicketsModule {}
