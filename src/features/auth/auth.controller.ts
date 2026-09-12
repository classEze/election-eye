import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from 'src/shared/decorators/public.decorator';
import {
  EmailAddressDto,
  LoginDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './auth.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(200)
  @Post('login')
  async signIn(@Body() dto: LoginDto) {
    return this.authService.signIn(dto);
  }

  @HttpCode(200)
  @Post('admin-login')
  adminSignIn(@Body() dto: LoginDto) {
    return this.authService.adminSignIn(dto);
  }

  @Post('reset-password-token')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async requestPasswordResetToken(@Body() dto: EmailAddressDto) {
    return this.authService.requestPasswordResetToken(dto.emailAddress);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetPassword(
    @Body()
    resetObj: ResetPasswordDto,
  ) {
    return this.authService.requestPasswordReset(resetObj);
  }

  @Post('admin-reset-password-token')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async requestAdminPasswordResetToken(@Body() dto: EmailAddressDto) {
    return this.authService.requestAdminPasswordResetToken(dto.emailAddress);
  }

  @Post('admin-reset-password')
  async resetAdminPassword(@Body() resetObj: ResetPasswordDto) {
    return this.authService.requestAdminPasswordReset(resetObj);
  }

  @Post('verify-email')
  async verifyUserEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyUserEmail(dto.token);
  }

  @Post('verify-admin-email')
  async verifyAdminEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyAdminEmail(dto.token);
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resendUserVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendUserVerification(dto);
  }

  @Post('resend-admin-verification')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resendAdminVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendAdminVerification(dto);
  }
}
