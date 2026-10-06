import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ticketEvidenceMaxBytes } from './tickets.constants';

@Injectable()
export class TicketEvidenceFileInterceptor implements NestInterceptor {
  private readonly upload: NestInterceptor;

  constructor() {
    const Interceptor = FileInterceptor('file', {
      limits: {
        fileSize: ticketEvidenceMaxBytes(process.env),
        files: 1,
      },
    });
    this.upload = new Interceptor();
  }

  async intercept(context: ExecutionContext, next: CallHandler) {
    try {
      return await this.upload.intercept(context, next);
    } catch (error) {
      if (error instanceof PayloadTooLargeException) {
        throw new PayloadTooLargeException('File is too large');
      }
      throw error;
    }
  }
}
