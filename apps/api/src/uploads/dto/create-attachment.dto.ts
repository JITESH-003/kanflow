import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { AttachmentType } from '../../generated/prisma/client';

export class CreateAttachmentDto {
  @IsOptional()
  @IsString()
  ticketId?: string;

  @IsOptional()
  @IsString()
  commentId?: string;

  @IsEnum(AttachmentType)
  type: AttachmentType;

  @IsString()
  @MaxLength(1000)
  url: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName: string;

  @IsInt()
  @Min(0)
  sizeBytes: number;
}
