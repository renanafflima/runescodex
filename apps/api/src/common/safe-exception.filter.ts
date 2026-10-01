import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { loggedErrorStack, loggedErrorSummary } from './redact-error';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        response.status(status).json({ statusCode: status, message: body });
        return;
      }
      response.status(status).json(body);
      return;
    }

    const stack = loggedErrorStack(exception);
    this.logger.error(loggedErrorSummary(exception), stack || undefined);
    response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
    });
  }
}
