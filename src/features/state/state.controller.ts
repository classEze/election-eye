import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { StateService } from './state.service';
import { UpdateStateDto, CreateStateArrayDto } from './state.dto';
import { Allowed } from 'src/shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';
import { FileInterceptor } from '@nestjs/platform-express';
import { State } from './state.entity';

@Controller('states')
export class StateController {
  constructor(private readonly stateService: StateService) {}

  @Get('template')
  downloadTemplate(@Res({ passthrough: true }) res: Response): string {
    const csv = this.stateService.generateTemplate();
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition':
        'attachment; filename="states_upload_template.csv"',
    });
    return csv;
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createStateArrayDto: CreateStateArrayDto,
  ): Promise<State[]> {
    return this.stateService.create(createStateArrayDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadState(
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
  ): Promise<State[]> {
    return this.stateService.uploadStates(file);
  }

  @Get()
  async findAll(): Promise<State[]> {
    return this.stateService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<State> {
    return this.stateService.findOne(+id);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateStateDto: UpdateStateDto,
  ): Promise<State> {
    return this.stateService.update(+id, updateStateDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Patch(':id')
  async patchUpdate(
    @Param('id') id: string,
    @Body() updateStateDto: UpdateStateDto,
  ): Promise<State> {
    return this.stateService.update(+id, updateStateDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<State> {
    return this.stateService.remove(+id);
  }
}
