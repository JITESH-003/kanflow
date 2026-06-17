import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../teams/rbac/roles.decorator';
import { TeamRolesGuard } from '../teams/rbac/team-roles.guard';
import { AddAssigneeDto } from './dto/add-assignee.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { MoveTicketDto } from './dto/move-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketRolesGuard } from './rbac/ticket-roles.guard';
import { TicketsService } from './tickets.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('teams/:teamId/tickets')
  @UseGuards(TeamRolesGuard)
  list(@Param('teamId') teamId: string) {
    return this.tickets.listForTeam(teamId);
  }

  @Post('tickets')
  @UseGuards(TicketRolesGuard)
  @Roles('admin', 'manager', 'member')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.tickets.create(user.id, dto);
  }

  @Get('tickets/:id')
  @UseGuards(TicketRolesGuard)
  getOne(@Param('id') id: string) {
    return this.tickets.getOne(id);
  }

  @Patch('tickets/:id')
  @UseGuards(TicketRolesGuard)
  @Roles('admin', 'manager', 'member')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.tickets.update(id, user.id, dto);
  }

  @Patch('tickets/:id/stage')
  @UseGuards(TicketRolesGuard)
  @Roles('admin', 'manager', 'member')
  move(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MoveTicketDto) {
    return this.tickets.move(id, user.id, dto.stageId);
  }

  @Post('tickets/:id/assignees')
  @UseGuards(TicketRolesGuard)
  @Roles('admin', 'manager', 'member')
  addAssignee(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddAssigneeDto) {
    return this.tickets.addAssignee(id, user.id, dto.userId);
  }

  @Delete('tickets/:id/assignees/:userId')
  @UseGuards(TicketRolesGuard)
  @Roles('admin', 'manager', 'member')
  removeAssignee(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.tickets.removeAssignee(id, user.id, userId);
  }

  @Get('tickets/:id/comments')
  @UseGuards(TicketRolesGuard)
  comments(@Param('id') id: string) {
    return this.tickets.listComments(id);
  }

  @Post('tickets/:id/comments')
  @UseGuards(TicketRolesGuard)
  @Roles('admin', 'manager', 'member')
  addComment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateCommentDto) {
    return this.tickets.addComment(id, user.id, dto.body);
  }
}
