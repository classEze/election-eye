import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  ParseIntPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuditService } from './audit.service';
import { AuditLogFilterDto } from './audit.dto';
import { Allowed } from 'src/shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Get('export')
  async exportAuditLogs(
    @Query() query: AuditLogFilterDto,
    @Res() res: Response,
  ): Promise<void> {
    return this.auditService.exportCsv(query, res);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Get()
  async getAuditLogs(@Query() query: AuditLogFilterDto) {
    return this.auditService.findAll(query);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Get(':id')
  async getAuditLogById(@Param('id', ParseIntPipe) id: number) {
    return this.auditService.findOne(id);
  }
}
