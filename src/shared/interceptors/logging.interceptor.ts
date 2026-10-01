import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { getClientIp } from '../helpers/ip.helper';
import { sanitizePayload } from '../helpers/sanitizer.helper';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const { method, originalUrl } = req;
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown-Agent';
    const startTime = Date.now();

    // Prepare sanitized incoming payload info
    const reqQuery = req.query as Record<string, unknown> | undefined;
    const reqBody = req.body as Record<string, unknown> | undefined;

    const query =
      reqQuery && Object.keys(reqQuery).length
        ? JSON.stringify(sanitizePayload(reqQuery))
        : undefined;

    const body =
      method !== 'GET' && reqBody && Object.keys(reqBody).length
        ? JSON.stringify(sanitizePayload(reqBody))
        : undefined;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode;
          const messageParts = [
            `${method} ${originalUrl} ${statusCode} +${duration}ms`,
            `IP: ${clientIp}`,
            `Agent: ${userAgent}`,
          ];

          if (query) messageParts.push(`Query: ${query}`);
          if (body) messageParts.push(`Body: ${body}`);

          this.logger.log(messageParts.join(' | '));
        },
        error: (err: unknown) => {
          const duration = Date.now() - startTime;
          const statusCode =
            typeof err === 'object' && err !== null && 'status' in err
              ? (err as { status: number }).status
              : 500;

          const messageParts = [
            `FAILED ${method} ${originalUrl} ${statusCode} +${duration}ms`,
            `IP: ${clientIp}`,
            `Agent: ${userAgent}`,
          ];

          if (query) messageParts.push(`Query: ${query}`);
          if (body) messageParts.push(`Body: ${body}`);

          this.logger.warn(messageParts.join(' | '));
        },
      }),
    );
  }
}
