import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './shared/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  homeUrl() {
    return { message: 'Welcome to Election Eye NG' };
  }
  @Get('health')
  healthMethod() {
    return { message: 'Application is up and running' };
  }
}
