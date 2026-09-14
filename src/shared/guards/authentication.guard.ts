import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRepository } from 'src/features/user/user.repository';
import { AdminRepository } from 'src/features/admin/admin.repository';
import {
  AccountType,
  CacheTTL,
  getUserInfoCacheKey,
  getAdminInfoCacheKey,
} from '../constants/cache.constant';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly logger = new Logger(AuthenticationGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly userRepository: UserRepository,
    private readonly adminRepository: AdminRepository,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request: Request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token absent in request headers');
    }

    let payload: Record<string, any>;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException(
        'Invalid token: Token could not be verified',
      );
    }

    const userId = Number(payload.sub ?? payload.id);
    if (!userId) {
      throw new UnauthorizedException('Invalid token: User ID missing');
    }
    const isAdmin = payload.type === AccountType.ADMIN;
    const cacheKey = isAdmin
      ? getAdminInfoCacheKey(userId)
      : getUserInfoCacheKey(userId);

    let user = await this.cacheManager.get<Record<string, any>>(cacheKey);

    if (user) {
      this.logger.log(`CACHE HIT:: ${cacheKey}`);
    } else {
      this.logger.log(`CACHE MISS:: ${cacheKey}`);

      const dbUser = isAdmin
        ? await this.adminRepository.findByIdWithRelations(userId)
        : await this.userRepository.findByIdWithRelations(userId);

      if (!dbUser) {
        throw new UnauthorizedException('User account not found');
      }

      if (!dbUser.isActive) {
        throw new UnauthorizedException('User account is not active');
      }

      user = dbUser;

      await this.cacheManager.set(cacheKey, user, CacheTTL.ONE_DAY);
    }

    if (!user) {
      throw new UnauthorizedException('User could not be loaded');
    }

    request['user'] = user;

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
