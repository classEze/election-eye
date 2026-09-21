import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PoliticalPartyService } from './political-party.service';
import {
  CreatePoliticalPartyDto,
  PoliticalPartyQueryDto,
  UpdatePartyLogoDto,
  UpdatePoliticalPartyDto,
} from './political-party.dto';
import { Allowed } from '../../shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';
import { PoliticalParty } from './political-party.entity';

@Controller('political-parties')
export class PoliticalPartyController {
  constructor(
    private readonly politicalPartyService: PoliticalPartyService,
  ) {}

  @Get()
  async findAll(
    @Query() queryDto: PoliticalPartyQueryDto,
  ): Promise<PoliticalParty[]> {
    return this.politicalPartyService.findAll(queryDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PoliticalParty> {
    return this.politicalPartyService.findOne(+id);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('logo'))
  async create(
    @Body() createDto: CreatePoliticalPartyDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB logo max size
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false,
        }),
    )
    file?: Express.Multer.File,
  ): Promise<PoliticalParty> {
    return this.politicalPartyService.create(createDto, file);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePoliticalPartyDto,
  ): Promise<PoliticalParty> {
    return this.politicalPartyService.update(+id, updateDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Patch(':id')
  async patch(
    @Param('id') id: string,
    @Body() updateDto: UpdatePoliticalPartyDto,
  ): Promise<PoliticalParty> {
    return this.politicalPartyService.update(+id, updateDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Patch(':id/logo')
  @UseInterceptors(FileInterceptor('logo'))
  async updateLogo(
    @Param('id') id: string,
    @Body() updateLogoDto?: UpdatePartyLogoDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB logo max size
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false,
        }),
    )
    file?: Express.Multer.File,
  ): Promise<PoliticalParty> {
    return this.politicalPartyService.updateLogo(+id, updateLogoDto, file);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Delete(':id')
  async softDelete(@Param('id') id: string): Promise<{ message: string }> {
    return this.politicalPartyService.softDelete(+id);
  }
}
