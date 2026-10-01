import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from 'src/shared/decorators/public.decorator';
import { GetUser } from 'src/shared/decorators/get-user.decorator';
import { Audit } from 'src/shared/decorators/audit.decorator';
import {
  ChangePasswordDto,
  EmailAddressDto,
  LoginDto,
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
  async signIn(@Body() dto: LoginDto) {
    return this.authService.signIn(dto);
  }

  @Audit({ action: 'AUTH.ADMIN_LOGIN', entityName: 'Admin', logFailures: true })
  @Public()
  @HttpCode(200)
  @Post('admin-login')
  adminSignIn(@Body() dto: LoginDto) {
    return this.authService.adminSignIn(dto);
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
