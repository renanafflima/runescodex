import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';

export function isMissingDatabaseObject(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }
  const code = (error as { code?: string }).code;
  return code === 'P2021' || code === 'P2022';
}

export function missingSchemaInterceptor(message: string) {
  @Injectable()
  class BoundMissingSchemaInterceptor implements NestInterceptor {
    intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
      return next.handle().pipe(
        catchError((error: unknown) => {
          if (isMissingDatabaseObject(error)) {
            return throwError(() => new ServiceUnavailableException(message));
          }
          return throwError(() => error);
        }),
      );
    }
  }
  return BoundMissingSchemaInterceptor;
}
