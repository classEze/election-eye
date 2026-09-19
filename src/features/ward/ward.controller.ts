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
import { WardService } from './ward.service';
import { CreateWardArrayDto, UpdateWardDto } from './ward.dto';
import { Allowed } from '../../shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';
import { FileInterceptor } from '@nestjs/platform-express';
import { Ward } from './ward.entity';
import { GetUser } from '../../shared/decorators/get-user.decorator';
import { User } from '../user/user.entity';

@Controller('wards')
export class WardController {
  constructor(private readonly wardService: WardService) {}

  @Get('template')
  downloadTemplate(@Res({ passthrough: true }) res: Response): string {
    const csv = this.wardService.generateTemplate();
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="wards_upload_template.csv"',
    });
    return csv;
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  async createMultiple(
    @Body() createWardArrayDto: CreateWardArrayDto,
  ): Promise<Ward[]> {
    return this.wardService.createMultiple(createWardArrayDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadWards(
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
    @Body('lgaId') lgaId: string,
    @GetUser() user: User,
  ) {
    return this.wardService.uploadWards(file, +lgaId, user);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Post('upload-generic')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadWardsGeneric(
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
    return this.wardService.uploadWardsGeneric(file, user);
  }

  @Get()
  async findAll(): Promise<Ward[]> {
    return this.wardService.findAll();
  }

  @Get('lga/:lgaId')
  async findByLga(@Param('lgaId') lgaId: string): Promise<Ward[]> {
    return this.wardService.findByLga(+lgaId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Ward> {
    return this.wardService.findOne(+id);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateWardDto: UpdateWardDto,
  ): Promise<Ward> {
    return this.wardService.update(+id, updateWardDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Ward> {
    return this.wardService.remove(+id);
  }
}
