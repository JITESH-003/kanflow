import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { UploadsService } from './uploads.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('uploads/sign')
  sign() {
    return this.uploads.signUpload();
  }

  @Post('attachments')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAttachmentDto) {
    return this.uploads.createAttachment(user.id, dto);
  }

  @Delete('attachments/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.uploads.deleteAttachment(user.id, id);
  }
}
