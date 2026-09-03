import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from 'src/decorators/public.decorator';
import { ResetPasswordDto } from './auth.dto';

@Controller('auth')
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(200)
  @Post('login')
  async signIn(@Body() loginUserObj: { email: string; password: string }) {
    return this.authService.signIn(loginUserObj);
  }

  @Post('reset-password-token')
  async requestPasswordResetToken(@Body('email') email: string) {
    return this.authService.requestPasswordResetToken(email);
  }

  @Post('reset-password')
  async resetPassword(
    @Body()
    resetObj: ResetPasswordDto,
  ) {
    return this.authService.requestPasswordReset(resetObj);
  }
}
