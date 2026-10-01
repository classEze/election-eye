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
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
  constructor(private readonly politicalPartyService: PoliticalPartyService) {}

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

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreatePoliticalPartyDto,
  ): Promise<PoliticalParty> {
    return this.politicalPartyService.create(createDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePoliticalPartyDto,
  ): Promise<PoliticalParty> {
    return this.politicalPartyService.update(+id, updateDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Patch(':id')
  async patch(
    @Param('id') id: string,
    @Body() updateDto: UpdatePoliticalPartyDto,
  ): Promise<PoliticalParty> {
    return this.politicalPartyService.update(+id, updateDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Patch(':id/logo')
  async updateLogo(
    @Param('id') id: string,
    @Body() updateLogoDto: UpdatePartyLogoDto,
  ): Promise<PoliticalParty> {
    return this.politicalPartyService.updateLogo(+id, updateLogoDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Delete(':id')
  async softDelete(@Param('id') id: string): Promise<{ message: string }> {
    return this.politicalPartyService.softDelete(+id);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Post('logo-upload-url')
  async getLogoUploadUrl(
    @Body('contentType') contentType: string,
    @Body('originalFilename') originalFilename?: string,
  ) {
    if (!contentType || !contentType.startsWith('image/')) {
      throw new BadRequestException('Content type must be an image type (e.g. image/png)');
    }
    return this.politicalPartyService.getLogoUploadUrl(contentType, originalFilename);
  }
}
