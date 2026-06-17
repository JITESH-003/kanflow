import {
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Priority } from '../../generated/prisma/client';

export class CreateTicketDto {
  @IsString()
  teamId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsInt()
  @Min(0)
  effort?: number;

  @IsOptional()
  @IsISO8601()
  etaAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];
}
