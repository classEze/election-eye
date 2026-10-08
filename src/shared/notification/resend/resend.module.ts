import { Module, Global } from '@nestjs/common';
import { ResendService } from './resend.service';

@Global()
@Module({
  providers: [ResendService],
  exports: [ResendService],
})
export class ResendModule {}
