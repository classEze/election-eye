import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CreateAspirantDto, AspirantQueryDto } from './aspirant.dto';
import { AspirantService } from './aspirant.service';
import { Allowed } from 'src/shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';

@Controller('aspirants')
export class AspirantController {
  constructor(private readonly aspirantService: AspirantService) {}

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_ADMIN,
  ])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateAspirantDto) {
    return this.aspirantService.create(dto);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_ADMIN,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
    RoleCode.ASPIRANT,
  ])
  @Get()
  findAll(@Query() query: AspirantQueryDto) {
    return this.aspirantService.findAll(query);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_ADMIN,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
    RoleCode.ASPIRANT,
  ])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aspirantService.findOne(+id);
  }
}
