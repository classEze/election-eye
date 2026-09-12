import { Body, Controller, Post } from '@nestjs/common';
import { CreateAspirantDto } from './aspirant.dto';
import { AspirantService } from './aspirant.service';

@Controller('aspirants')
export class AspirantController {
  constructor(private readonly aspirantService: AspirantService) {}

  @Post()
  create(@Body() dto: CreateAspirantDto) {
    return this.aspirantService.create(dto);
  }
}
