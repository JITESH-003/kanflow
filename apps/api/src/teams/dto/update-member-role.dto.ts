import { IsEnum } from 'class-validator';
import { Role } from '../../generated/prisma/client';

export class UpdateMemberRoleDto {
  @IsEnum(Role)
  role: Role;
}
