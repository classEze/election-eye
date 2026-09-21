import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

@Controller('results')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @Allowed([
    RoleCode.PU_AGENT,
    RoleCode.WARD_COORDINATOR,
    RoleCode.LGA_COORDINATOR,
    RoleCode.CLIENT_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.SUPER_ADMIN,
  ])
  @UseGuards(SubmissionWindowGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('ec8aPhoto'))
  async submitResult(
    @Body() createResultDto: CreateResultDto,
    @GetUser() user: User,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: 10 * 1024 * 1024, // 10MB EC8A form size limit
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false,
        }),
    )
    file?: Express.Multer.File,
  ): Promise<Result> {
    return this.resultService.submitResult(createResultDto, user, file);
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
  async getOfficeSummary(@Param('officeId') officeId: string) {
    return this.resultService.getOfficePartySummary(+officeId);
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

  @Get('reports/electoral-office/:officeId/ward/:wardId')
  async getOfficeWardReport(
    @Param('officeId') officeId: string,
    @Param('wardId') wardId: string,
  ) {
    return this.resultService.getOfficeWardReport(+officeId, +wardId);
  }

  @Get('reports/electoral-office/:officeId/lga/:lgaId')
  async getOfficeLgaReport(
    @Param('officeId') officeId: string,
    @Param('lgaId') lgaId: string,
  ) {
    return this.resultService.getOfficeLgaReport(+officeId, +lgaId);
  }

  @Get('reports/electoral-office/:officeId/state/:stateId')
  async getOfficeStateReport(
    @Param('officeId') officeId: string,
    @Param('stateId') stateId: string,
  ) {
    return this.resultService.getOfficeStateReport(+officeId, +stateId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Result> {
    return this.resultService.findOne(+id);
  }

  // Result verification is open to Admins, Ward/LGA Coordinators, and Aspirants, but strictly closed to PU Agents
  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_ADMIN,
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
