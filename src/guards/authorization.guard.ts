import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { ALLOWED_ROLES } from 'src/decorators/allowed.decorator';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const allowedRoles = this.reflector.getAllAndOverride<string[]>(
      ALLOWED_ROLES,
      [context.getHandler(), context.getClass()],
    );
    const request: Request & { user: { code: string } } = context
      .switchToHttp()
      .getRequest();

    // If no roles are defined, allow access
    if (!allowedRoles || allowedRoles.length === 0) return true;

    if (allowedRoles.includes(request.user.code)) return true;

    throw new ForbiddenException('No access to this resource');
  }
}
