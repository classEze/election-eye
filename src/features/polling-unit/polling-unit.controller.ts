import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
  HttpCode,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PollingUnitService } from './polling-unit.service';
import {
  CreatePollingUnitArrayDto,
  UpdatePollingUnitDto,
} from './polling-unit.dto';
import { Allowed } from '../../shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';
import { FileInterceptor } from '@nestjs/platform-express';
import { PollingUnit } from './polling-unit.entity';
import { GetUser } from '../../shared/decorators/get-user.decorator';
import { User } from '../user/user.entity';

@Controller('polling-units')
export class PollingUnitController {
  constructor(private readonly pollingUnitService: PollingUnitService) {}

  @Get('template')
  downloadTemplate(@Res({ passthrough: true }) res: Response): string {
    const csv = this.pollingUnitService.generateTemplate();
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition':
        'attachment; filename="polling_units_upload_template.csv"',
    });
    return csv;
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  async createMultiple(
    @Body() createPollingUnitArrayDto: CreatePollingUnitArrayDto,
  ): Promise<PollingUnit[]> {
    return this.pollingUnitService.createMultiple(createPollingUnitArrayDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadPollingUnits(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
    @Body('wardId') wardId: string,
    @GetUser() user: User,
  ) {
    return this.pollingUnitService.uploadPollingUnits(file, +wardId, user);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Post('upload-generic')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadPollingUnitsGeneric(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
    @GetUser() user: User,
  ) {
    return this.pollingUnitService.uploadPollingUnitsGeneric(file, user);
  }

  @Get()
  async findAll(): Promise<PollingUnit[]> {
    return this.pollingUnitService.findAll();
  }

  @Get('ward/:wardId')
  async findByWard(@Param('wardId') wardId: string): Promise<PollingUnit[]> {
    return this.pollingUnitService.findByWard(+wardId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PollingUnit> {
    return this.pollingUnitService.findOne(+id);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePollingUnitDto: UpdatePollingUnitDto,
  ): Promise<PollingUnit> {
    return this.pollingUnitService.update(+id, updatePollingUnitDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<PollingUnit> {
    return this.pollingUnitService.remove(+id);
  }
}
