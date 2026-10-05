import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpStatus,
  HttpCode,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ResultService } from './result.service';
import {
  CreateResultDto,
  ResultFilterDto,
  VerifyResultDto,
} from './result.dto';
import { Allowed } from '../../shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';
import { GetUser } from '../../shared/decorators/get-user.decorator';
import { User } from '../user/user.entity';
import { SubmissionWindowGuard } from '../../shared/guards/submission-window.guard';
import { Result } from './result.entity';
import { Audit } from '../../shared/decorators/audit.decorator';

@Controller('results')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @Audit({ action: 'RESULT.SUBMIT', entityName: 'Result', logFailures: true })
  @Allowed([
    RoleCode.PU_AGENT,
    RoleCode.WARD_COORDINATOR,
    RoleCode.LGA_COORDINATOR,
    RoleCode.CLIENT_USER,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.SUPER_ADMIN,
  ])
  @UseGuards(SubmissionWindowGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submitResult(
    @Body() createResultDto: CreateResultDto,
    @GetUser() user: User,
  ): Promise<Result> {
    return this.resultService.submitResult(createResultDto, user);
  }

  @Audit({ skip: true })
  @Allowed([
    RoleCode.PU_AGENT,
    RoleCode.WARD_COORDINATOR,
    RoleCode.LGA_COORDINATOR,
    RoleCode.CLIENT_USER,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.SUPER_ADMIN,
  ])
  @Post('media-upload-urls')
  @HttpCode(HttpStatus.OK)
  async getMediaUploadUrls(
    @Body('requestPhoto') requestPhoto: boolean,
    @Body('requestVideo') requestVideo: boolean,
    @Body('photoContentType') photoContentType?: string,
    @Body('videoContentType') videoContentType?: string,
  ) {
    return this.resultService.getMediaUploadUrls(
      requestPhoto,
      requestVideo,
      photoContentType,
      videoContentType,
    );
  }

  @Get()
  async findAll(@Query() query: ResultFilterDto) {
    return this.resultService.findAll(query);
  }

  @Get('polling-unit/:puId')
  async findByPollingUnit(@Param('puId') puId: string): Promise<Result[]> {
    return this.resultService.findByPollingUnit(+puId);
  }

  @Get('electoral-office/:officeId/summary')
  async getOfficeSummary(
    @Param('officeId') officeId: string,
    @GetUser() user: User,
  ) {
    const userPartyId =
      user.role.code === RoleCode.SUPER_ADMIN ||
      user.role.code === RoleCode.SYSTEM_ADMIN ||
      user.role.code === RoleCode.CLIENT_USER
        ? undefined
        : user.aspirant?.politicalParty?.id;

    return this.resultService.getOfficePartySummary(+officeId, userPartyId);
  }

  @Get('electoral-office/:officeId/progress')
  async getOfficeProgress(@Param('officeId') officeId: string) {
    return this.resultService.getOfficeUploadProgress(+officeId);
  }

  @Get('electoral-office/:officeId/forms')
  async getOfficeEc8aForms(
    @Param('officeId') officeId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.resultService.getOfficeEc8aForms(+officeId, +page, +limit);
  }

  // --- Electoral Office Geographical Breakdown Reports ---

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
    RoleCode.PU_AGENT,
    RoleCode.ASPIRANT,
  ])
  @Get('reports/polling-unit')
  async getOfficePollingUnitReport(
    @Query('officeId') officeIdStr: string,
    @Query('pollingUnitId') puIdStr: string,
    @GetUser() user: User,
  ) {
    const officeId = officeIdStr
      ? parseInt(officeIdStr, 10)
      : user.aspirant?.electoralOffice?.id;
    const puId = puIdStr ? parseInt(puIdStr, 10) : user.assignedPu?.id;
    if (!officeId || !puId)
      throw new BadRequestException(
        'Office ID and Polling Unit ID are required.',
      );

    if (user.role.code === RoleCode.PU_AGENT && user.assignedPu?.id !== puId) {
      throw new ForbiddenException(
        'Access denied to this Polling Unit report.',
      );
    }

    const isPlatformAdmin =
      user.role.code === RoleCode.SUPER_ADMIN ||
      user.role.code === RoleCode.SYSTEM_ADMIN;

    const userPartyId = isPlatformAdmin
      ? undefined
      : user.aspirant?.politicalParty?.id ||
        user.aspirantAccount?.politicalParty?.id;

    return this.resultService.getOfficePollingUnitReport(
      officeId,
      puId,
      userPartyId,
    );
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
    RoleCode.PU_AGENT,
    RoleCode.ASPIRANT,
  ])
  @Get('reports/polling-unit/export')
  async exportOfficePollingUnitReport(
    @Query('officeId') officeIdStr: string,
    @Query('pollingUnitId') puIdStr: string,
    @Query('format') formatStr: string,
    @GetUser() user: User,
    @Res() res: Response,
  ) {
    const officeId = officeIdStr
      ? parseInt(officeIdStr, 10)
      : user.aspirant?.electoralOffice?.id;
    const puId = puIdStr ? parseInt(puIdStr, 10) : user.assignedPu?.id;
    if (!officeId || !puId)
      throw new BadRequestException(
        'Office ID and Polling Unit ID are required.',
      );

    if (user.role.code === RoleCode.PU_AGENT && user.assignedPu?.id !== puId) {
      throw new ForbiddenException(
        'Access denied to this Polling Unit report export.',
      );
    }

    const isPlatformAdmin =
      user.role.code === RoleCode.SUPER_ADMIN ||
      user.role.code === RoleCode.SYSTEM_ADMIN;

    const userPartyId = isPlatformAdmin
      ? undefined
      : user.aspirant?.politicalParty?.id ||
        user.aspirantAccount?.politicalParty?.id;

    const format = formatStr?.toLowerCase() === 'csv' ? 'csv' : 'pdf';
    const exportResult = await this.resultService.exportOfficePollingUnitReport(
      officeId,
      puId,
      userPartyId,
      format,
    );

    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportResult.filename}"`,
    );
    res.setHeader('Content-Length', exportResult.buffer.length);
    res.end(exportResult.buffer);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
    RoleCode.ASPIRANT,
  ])
  @Get('reports/ward')
  async getOfficeWardReport(
    @Query('officeId') officeIdStr: string,
    @Query('wardId') wardIdStr: string,
    @GetUser() user: User,
  ) {
    const officeId = officeIdStr
      ? parseInt(officeIdStr, 10)
      : user.aspirant?.electoralOffice?.id;
    const wardId = wardIdStr ? parseInt(wardIdStr, 10) : user.assignedWard?.id;
    if (!officeId || !wardId)
      throw new BadRequestException('Office ID and Ward ID are required.');

    if (
      user.role.code === RoleCode.WARD_COORDINATOR &&
      user.assignedWard?.id !== wardId
    ) {
      throw new ForbiddenException('Access denied to this Ward report.');
    }

    const isPlatformAdmin =
      user.role.code === RoleCode.SUPER_ADMIN ||
      user.role.code === RoleCode.SYSTEM_ADMIN;

    const userPartyId = isPlatformAdmin
      ? undefined
      : user.aspirant?.politicalParty?.id ||
        user.aspirantAccount?.politicalParty?.id;

    return this.resultService.getOfficeWardReport(
      officeId,
      wardId,
      userPartyId,
    );
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
    RoleCode.ASPIRANT,
  ])
  @Get('reports/ward/export')
  async exportOfficeWardReport(
    @Query('officeId') officeIdStr: string,
    @Query('wardId') wardIdStr: string,
    @Query('format') formatStr: string,
    @GetUser() user: User,
    @Res() res: Response,
  ) {
    const officeId = officeIdStr
      ? parseInt(officeIdStr, 10)
      : user.aspirant?.electoralOffice?.id;
    const wardId = wardIdStr ? parseInt(wardIdStr, 10) : user.assignedWard?.id;
    if (!officeId || !wardId)
      throw new BadRequestException('Office ID and Ward ID are required.');

    if (
      user.role.code === RoleCode.WARD_COORDINATOR &&
      user.assignedWard?.id !== wardId
    ) {
      throw new ForbiddenException('Access denied to this Ward report export.');
    }

    const isPlatformAdmin =
      user.role.code === RoleCode.SUPER_ADMIN ||
      user.role.code === RoleCode.SYSTEM_ADMIN;

    const userPartyId = isPlatformAdmin
      ? undefined
      : user.aspirant?.politicalParty?.id ||
        user.aspirantAccount?.politicalParty?.id;

    const format = formatStr?.toLowerCase() === 'csv' ? 'csv' : 'pdf';
    const exportResult = await this.resultService.exportOfficeWardReport(
      officeId,
      wardId,
      userPartyId,
      format,
    );

    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportResult.filename}"`,
    );
    res.setHeader('Content-Length', exportResult.buffer.length);
    res.end(exportResult.buffer);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.ASPIRANT,
  ])
  @Get('reports/lga')
  async getOfficeLgaReport(
    @Query('officeId') officeIdStr: string,
    @Query('lgaId') lgaIdStr: string,
    @GetUser() user: User,
  ) {
    const officeId = officeIdStr
      ? parseInt(officeIdStr, 10)
      : user.aspirant?.electoralOffice?.id;
    const lgaId = lgaIdStr ? parseInt(lgaIdStr, 10) : user.assignedLga?.id;
    if (!officeId || !lgaId)
      throw new BadRequestException('Office ID and LGA ID are required.');

    if (
      user.role.code === RoleCode.LGA_COORDINATOR &&
      user.assignedLga?.id !== lgaId
    ) {
      throw new ForbiddenException('Access denied to this LGA report.');
    }

    const isPlatformAdmin =
      user.role.code === RoleCode.SUPER_ADMIN ||
      user.role.code === RoleCode.SYSTEM_ADMIN;

    const userPartyId = isPlatformAdmin
      ? undefined
      : user.aspirant?.politicalParty?.id ||
        user.aspirantAccount?.politicalParty?.id;

    return this.resultService.getOfficeLgaReport(officeId, lgaId, userPartyId);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.ASPIRANT,
  ])
  @Get('reports/lga/export')
  async exportOfficeLgaReport(
    @Query('officeId') officeIdStr: string,
    @Query('lgaId') lgaIdStr: string,
    @Query('format') formatStr: string,
    @GetUser() user: User,
    @Res() res: Response,
  ) {
    const officeId = officeIdStr
      ? parseInt(officeIdStr, 10)
      : user.aspirant?.electoralOffice?.id;
    const lgaId = lgaIdStr ? parseInt(lgaIdStr, 10) : user.assignedLga?.id;
    if (!officeId || !lgaId)
      throw new BadRequestException('Office ID and LGA ID are required.');

    if (
      user.role.code === RoleCode.LGA_COORDINATOR &&
      user.assignedLga?.id !== lgaId
    ) {
      throw new ForbiddenException('Access denied to this LGA report export.');
    }

    const isPlatformAdmin =
      user.role.code === RoleCode.SUPER_ADMIN ||
      user.role.code === RoleCode.SYSTEM_ADMIN;

    const userPartyId = isPlatformAdmin
      ? undefined
      : user.aspirant?.politicalParty?.id ||
        user.aspirantAccount?.politicalParty?.id;

    const format = formatStr?.toLowerCase() === 'csv' ? 'csv' : 'pdf';
    const exportResult = await this.resultService.exportOfficeLgaReport(
      officeId,
      lgaId,
      userPartyId,
      format,
    );

    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportResult.filename}"`,
    );
    res.setHeader('Content-Length', exportResult.buffer.length);
    res.end(exportResult.buffer);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_USER,
    RoleCode.ASPIRANT,
  ])
  @Get('reports/state')
  async getOfficeStateReport(
    @Query('officeId') officeIdStr: string,
    @Query('stateId') stateIdStr: string,
    @GetUser() user: User,
  ) {
    const officeId = officeIdStr
      ? parseInt(officeIdStr, 10)
      : user.aspirant?.electoralOffice?.id;

    // Attempt fallback from aspirant.electoralOffice.state if loaded
    const userAssignedStateId = (user.aspirant?.electoralOffice as any)?.state
      ?.id;
    const stateId = stateIdStr ? parseInt(stateIdStr, 10) : userAssignedStateId;

    if (!officeId || !stateId)
      throw new BadRequestException('Office ID and State ID are required.');

    const isPlatformAdmin =
      user.role.code === RoleCode.SUPER_ADMIN ||
      user.role.code === RoleCode.SYSTEM_ADMIN;

    const userPartyId = isPlatformAdmin
      ? undefined
      : user.aspirant?.politicalParty?.id ||
        user.aspirantAccount?.politicalParty?.id;

    return this.resultService.getOfficeStateReport(
      officeId,
      stateId,
      userPartyId,
    );
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_USER,
    RoleCode.ASPIRANT,
  ])
  @Get('reports/state/export')
  async exportOfficeStateReport(
    @Query('officeId') officeIdStr: string,
    @Query('stateId') stateIdStr: string,
    @Query('format') formatStr: string,
    @GetUser() user: User,
    @Res() res: Response,
  ) {
    const officeId = officeIdStr
      ? parseInt(officeIdStr, 10)
      : user.aspirant?.electoralOffice?.id;

    const userAssignedStateId = (user.aspirant?.electoralOffice as any)?.state
      ?.id;
    const stateId = stateIdStr ? parseInt(stateIdStr, 10) : userAssignedStateId;

    if (!officeId || !stateId)
      throw new BadRequestException('Office ID and State ID are required.');

    const isPlatformAdmin =
      user.role.code === RoleCode.SUPER_ADMIN ||
      user.role.code === RoleCode.SYSTEM_ADMIN;

    const userPartyId = isPlatformAdmin
      ? undefined
      : user.aspirant?.politicalParty?.id ||
        user.aspirantAccount?.politicalParty?.id;

    const format = formatStr?.toLowerCase() === 'csv' ? 'csv' : 'pdf';
    const exportResult = await this.resultService.exportOfficeStateReport(
      officeId,
      stateId,
      userPartyId,
      format,
    );

    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportResult.filename}"`,
    );
    res.setHeader('Content-Length', exportResult.buffer.length);
    res.end(exportResult.buffer);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Result> {
    return this.resultService.findOne(+id);
  }

  // Result verification is open to Admins, Ward/LGA Coordinators, and Aspirants, but strictly closed to PU Agents
  @Audit({ action: 'RESULT.VERIFY', entityName: 'Result', logFailures: true })
  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
    RoleCode.ASPIRANT,
  ])
  @Patch(':id/verify')
  async verifyResult(
    @Param('id') id: string,
    @Body() verifyResultDto: VerifyResultDto,
    @GetUser() user: User,
  ): Promise<Result> {
    return this.resultService.verifyResult(+id, verifyResultDto, user);
  }
}
