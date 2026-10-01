import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import {
  AUDIT_METADATA_KEY,
  AuditOptions,
} from '../decorators/audit.decorator';
import { AuditService } from 'src/features/audit/audit.service';
import { AuditActorType, AuditStatus } from 'src/features/audit/audit.entity';
import { getClientIp } from '../helpers/ip.helper';
import { sanitizePayload } from '../helpers/sanitizer.helper';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const options = this.reflector.getAllAndOverride<AuditOptions>(
      AUDIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (options?.skip) {
      return next.handle();
    }

    const method = req.method;
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    // Only audit if route has explicit @Audit() decorator OR is a mutation
    if (!options && !isMutation) {
      return next.handle();
    }

    const handler = context.getHandler().name;
    const controller = context.getClass().name.replace(/Controller$/, '');

    const action =
      options?.action ||
      `${controller.toUpperCase()}.${handler.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`;

    const entityName = options?.entityName || controller;
    const clientIp = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || null;

    const reqBody = req.body as Record<string, unknown> | undefined;
    const requestPayload =
      reqBody && Object.keys(reqBody).length ? sanitizePayload(reqBody) : null;

    return next.handle().pipe(
      tap({
        next: (responseBody: unknown) => {
          const user = (req as unknown as { user?: Record<string, unknown> })
            .user;
          const { actorId, actorType, actorEmail, roleCode } =
            this.extractActor(user);

          const statusCode = res.statusCode || 200;

          const newState =
            responseBody && typeof responseBody === 'object'
              ? sanitizePayload(responseBody as Record<string, unknown>)
              : null;

          void this.auditService.record({
            actorId,
            actorType,
            actorEmail,
            roleCode,
            action,
            entityName,
            httpMethod: method,
            endpoint: req.originalUrl,
            statusCode,
            status: AuditStatus.SUCCESS,
            ipAddress: clientIp,
            userAgent,
            requestPayload,
            newState,
          });
        },
        error: (err: unknown) => {
          const user = (req as unknown as { user?: Record<string, unknown> })
            .user;
          const { actorId, actorType, actorEmail, roleCode } =
            this.extractActor(user);

          const statusCode =
            typeof err === 'object' && err !== null && 'status' in err
              ? (err as { status: number }).status
              : 500;

          const errorMessage =
            err instanceof Error ? err.message : 'Unknown Error';

          // Log critical failure
          void this.auditService.record({
            actorId,
            actorType,
            actorEmail,
            roleCode,
            action,
            entityName,
            httpMethod: method,
            endpoint: req.originalUrl,
            statusCode,
            status: AuditStatus.FAILURE,
            errorMessage,
            ipAddress: clientIp,
            userAgent,
            requestPayload,
          });
        },
      }),
    );
  }

  private extractActor(user?: Record<string, unknown>): {
    actorId: number | null;
    actorType: AuditActorType;
    actorEmail: string | null;
    roleCode: string | null;
  } {
    if (!user) {
      return {
        actorId: null,
        actorType: AuditActorType.ANONYMOUS,
        actorEmail: null,
        roleCode: null,
      };
    }

    const actorId = Number(user.id || user.sub) || null;
    const actorEmail =
      (user.emailAddress as string) || (user.email as string) || null;

    const roleObj = user.role as { code?: string; name?: string } | undefined;
    const roleCode =
      roleObj?.code || (typeof user.role === 'string' ? user.role : null);

    const isSystemAdmin =
      roleCode === 'SUPER_ADMIN' ||
      roleCode === 'SYSTEM_ADMIN' ||
      user.type === 'ADMIN';

    const actorType = isSystemAdmin
      ? AuditActorType.ADMIN
      : AuditActorType.USER;

    return {
      actorId,
      actorType,
      actorEmail,
      roleCode,
    };
  }
}
