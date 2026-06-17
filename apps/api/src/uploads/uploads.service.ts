import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';

@Injectable()
export class UploadsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  signUpload() {
    const cloudName = this.config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.getOrThrow<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.getOrThrow<string>('CLOUDINARY_API_SECRET');
    const folder = 'kanflow';
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
    return { cloudName, apiKey, timestamp, signature, folder };
  }

  async createAttachment(userId: string, dto: CreateAttachmentDto) {
    let teamId: string;
    let ticketId: string | null = dto.ticketId ?? null;

    if (dto.commentId) {
      const comment = await this.prisma.comment.findUnique({
        where: { id: dto.commentId },
        include: { ticket: true },
      });
      if (!comment) throw new NotFoundException('Comment not found');
      teamId = comment.ticket.teamId;
      ticketId = comment.ticketId;
    } else if (dto.ticketId) {
      const ticket = await this.prisma.ticket.findUnique({ where: { id: dto.ticketId } });
      if (!ticket) throw new NotFoundException('Ticket not found');
      teamId = ticket.teamId;
    } else {
      throw new BadRequestException('ticketId or commentId is required');
    }

    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member || member.role === 'viewer') {
      throw new ForbiddenException('You cannot add attachments to this ticket');
    }

    return this.prisma.attachment.create({
      data: {
        ticketId,
        commentId: dto.commentId ?? null,
        type: dto.type,
        url: dto.url,
        fileName: dto.fileName,
        sizeBytes: dto.sizeBytes,
        uploadedById: userId,
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
  }

  async deleteAttachment(userId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: true },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.ticket) {
      const member = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: attachment.ticket.teamId, userId } },
      });
      if (!member || member.role === 'viewer') throw new ForbiddenException('Not allowed');
    }
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    return { success: true };
  }
}
