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
import { AddMemberDto } from './dto/add-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { Roles } from './rbac/roles.decorator';
import { TeamRolesGuard } from './rbac/team-roles.guard';
import { TeamsService } from './teams.service';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTeamDto) {
    return this.teams.createTeam(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.teams.listTeams(user.id);
  }

  @Get(':id')
  @UseGuards(TeamRolesGuard)
  getOne(@Param('id') id: string) {
    return this.teams.getTeam(id);
  }

  @Get(':id/members')
  @UseGuards(TeamRolesGuard)
  members(@Param('id') id: string) {
    return this.teams.listMembers(id);
  }

  @Post(':id/members')
  @UseGuards(TeamRolesGuard)
  @Roles('admin', 'manager')
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.teams.addMember(id, dto);
  }

  @Patch(':id/members/:userId')
  @UseGuards(TeamRolesGuard)
  @Roles('admin', 'manager')
  updateRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.teams.updateMemberRole(id, userId, dto.role);
  }

  @Delete(':id/members/:userId')
  @UseGuards(TeamRolesGuard)
  @Roles('admin', 'manager')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.teams.removeMember(id, userId);
  }
}
