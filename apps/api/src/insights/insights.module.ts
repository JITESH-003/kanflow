import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TeamRolesGuard } from '../teams/rbac/team-roles.guard';
import { InsightsController } from './insights.controller';
import { InsightsScheduler } from './insights.scheduler';
import { InsightsService } from './insights.service';

@Module({
  imports: [NotificationsModule],
  controllers: [InsightsController],
  providers: [InsightsService, InsightsScheduler, TeamRolesGuard],
  exports: [InsightsService],
})
export class InsightsModule {}
