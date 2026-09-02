import { Module } from '@nestjs/common';
import { TermiiService } from './termii.service';
import { HttpClientModule } from 'src/default-modules/http.module';

@Module({
  providers: [TermiiService],
  exports: [TermiiService],
  imports: [HttpClientModule],
})
export class TermiiModule {}
