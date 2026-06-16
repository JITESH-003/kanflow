import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { WorkflowRuleType } from '../../generated/prisma/client';

export class StageInput {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug: string;

  @IsInt()
  @Min(0)
  position: number;

  @IsBoolean()
  isInitial: boolean;
}

export class RuleInput {
  @IsOptional()
  @IsString()
  id?: string;

  @IsEnum(WorkflowRuleType)
  type: WorkflowRuleType;

  @IsObject()
  config: Record<string, unknown>;
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageInput)
  stages: StageInput[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleInput)
  rules: RuleInput[];
}
