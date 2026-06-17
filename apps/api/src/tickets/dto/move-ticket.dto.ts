import { IsString } from 'class-validator';

export class MoveTicketDto {
  @IsString()
  stageId: string;
}
