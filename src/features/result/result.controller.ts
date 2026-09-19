import { Controller, Get } from '@nestjs/common';
import { Result } from './result.entity';
import { ResultService } from './result.service';

@Controller('results')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @Get()
  findAll(): Promise<Result[]> {
    return this.resultService.findAll();
  }
}
