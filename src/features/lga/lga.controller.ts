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
import { LgaService } from './lga.service';
import { CreateLgaArrayDto, UpdateLgaDto } from './lga.dto';
import { Allowed } from '../../shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';
import { FileInterceptor } from '@nestjs/platform-express';
import { Lga } from './lga.entity';
import { GetUser } from '../../shared/decorators/get-user.decorator';
import { User } from '../user/user.entity';

@Controller('lgas')
export class LgaController {
  constructor(private readonly lgaService: LgaService) {}

  @Get('template')
  downloadTemplate(@Res({ passthrough: true }) res: Response): string {
    const csv = this.lgaService.generateTemplate();
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="lgas_upload_template.csv"',
    });
    return csv;
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  async createMultiple(
    @Body() createLgaArrayDto: CreateLgaArrayDto,
  ): Promise<Lga[]> {
    return this.lgaService.createMultiple(createLgaArrayDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadLgas(
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
    @Body('stateId') stateId: string,
    @GetUser() user: User,
  ) {
    return this.lgaService.uploadLgas(file, +stateId, user);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Post('upload-generic')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadLgasGeneric(
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
    return this.lgaService.uploadLgasGeneric(file, user);
  }

  @Get()
  async findAll(): Promise<Lga[]> {
    return this.lgaService.findAll();
  }

  @Get('state/:stateId')
  async findByState(@Param('stateId') stateId: string): Promise<Lga[]> {
    return this.lgaService.findByState(+stateId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Lga> {
    return this.lgaService.findOne(+id);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateLgaDto: UpdateLgaDto,
  ): Promise<Lga> {
    return this.lgaService.update(+id, updateLgaDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Lga> {
    return this.lgaService.remove(+id);
  }
}
