import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from 'src/shared/decorators/public.decorator';
import { GetUser } from 'src/shared/decorators/get-user.decorator';
import { Audit } from 'src/shared/decorators/audit.decorator';
import {
  ChangePasswordDto,
  ClientType,
  EmailAddressDto,
  LoginDto,
  RefreshTokenDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './auth.dto';
import { Throttle } from '@nestjs/throttler';
import { User } from 'src/features/user/user.entity';
import { Admin } from 'src/features/admin/admin.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Audit({ action: 'AUTH.USER_LOGIN', entityName: 'User', logFailures: true })
  @Public()
  @HttpCode(200)
  @Post('login')
  async signIn(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientType = dto.clientType || ClientType.WEB;
    const result: any = await this.authService.signIn({ ...dto, clientType });

    if (result && result.refreshToken) {
      if (clientType === ClientType.WEB) {
        res.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/auth/refresh-token',
          maxAge: 12 * 60 * 60 * 1000, // 12 hours
        });
        const { refreshToken, ...responseBody } = result;
        return responseBody;
      }
    }

    return result;
  }

  @Audit({ action: 'AUTH.ADMIN_LOGIN', entityName: 'Admin', logFailures: true })
  @Public()
  @HttpCode(200)
  @Post('admin-login')
  async adminSignIn(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientType = dto.clientType || ClientType.WEB;
    const result: any = await this.authService.adminSignIn({
      ...dto,
      clientType,
    });

    if (result && result.refreshToken) {
      if (clientType === ClientType.WEB) {
        res.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/auth/refresh-token',
          maxAge: 12 * 60 * 60 * 1000, // 12 hours
        });
        const { refreshToken, ...responseBody } = result;
        return responseBody;
      }
    }

    return result;
  }

  @Audit({
    action: 'AUTH.REFRESH_TOKEN',
    entityName: 'User',
    logFailures: true,
  })
  @Public()
  @HttpCode(200)
  @Post('refresh-token')
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto?: RefreshTokenDto,
  ) {
    // 1. Extract token from Cookie, Authorization Header, x-refresh-token header, or Body
    const cookieToken = req.cookies?.refreshToken;
    const authHeader = req.headers['authorization'];
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;
    const customHeaderToken = req.headers['x-refresh-token'] as string;
    const bodyToken = dto?.refreshToken;

    const token = cookieToken || bearerToken || customHeaderToken || bodyToken;

    if (!token) {
      throw new UnauthorizedException(
        'Refresh token not provided in cookies, header, or body',
      );
    }

    const rotated = await this.authService.refreshTokens(token);

    // If request originated with a cookie, set rotated cookie
    if (cookieToken) {
      res.cookie('refreshToken', rotated.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/auth/refresh-token',
        maxAge: 12 * 60 * 60 * 1000,
      });
      return {
        accessToken: rotated.accessToken,
      };
    }

    return {
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
    };
  }

  @Public()
  @Post('reset-password-token')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async requestPasswordResetToken(@Body() dto: EmailAddressDto) {
    return this.authService.requestPasswordResetToken(dto.emailAddress);
  }

  @Audit({
    action: 'AUTH.RESET_PASSWORD',
    entityName: 'User',
    logFailures: true,
  })
  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetPassword(
    @Body()
    resetObj: ResetPasswordDto,
  ) {
    return this.authService.requestPasswordReset(resetObj);
  }

  @Public()
  @Post('admin-reset-password-token')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async requestAdminPasswordResetToken(@Body() dto: EmailAddressDto) {
    return this.authService.requestAdminPasswordResetToken(dto.emailAddress);
  }

  @Audit({
    action: 'AUTH.ADMIN_RESET_PASSWORD',
    entityName: 'Admin',
    logFailures: true,
  })
  @Public()
  @Post('admin-reset-password')
  async resetAdminPassword(@Body() resetObj: ResetPasswordDto) {
    return this.authService.requestAdminPasswordReset(resetObj);
  }

  @Audit({ action: 'AUTH.VERIFY_USER_EMAIL', entityName: 'User' })
  @Public()
  @Post('verify-email')
  async verifyUserEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyUserEmail(dto.token);
  }

  @Audit({ action: 'AUTH.VERIFY_ADMIN_EMAIL', entityName: 'Admin' })
  @Public()
  @Post('verify-admin-email')
  async verifyAdminEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyAdminEmail(dto.token);
  }

  @Public()
  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resendUserVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendUserVerification(dto);
  }

  @Public()
  @Post('resend-admin-verification')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resendAdminVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendAdminVerification(dto);
  }

  @Audit({
    action: 'AUTH.CHANGE_PASSWORD',
    entityName: 'User',
    logFailures: true,
  })
  @Post('change-password')
  async changePassword(@GetUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.authService.changeUserPassword(user.id, dto);
  }

  @Audit({
    action: 'AUTH.ADMIN_CHANGE_PASSWORD',
    entityName: 'Admin',
    logFailures: true,
  })
  @Post('admin-change-password')
  async changeAdminPassword(
    @GetUser() admin: Admin,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changeAdminPassword(admin.id, dto);
  }
}
