import { Controller, Get } from '@nestjs/common';
import { IncidentService } from './incident.service';

@Controller('incident-categories')
export class IncidentCategoryController {
  constructor(private readonly incidentService: IncidentService) {}

  @Get()
  async getCategories() {
    return this.incidentService.getCategories();
  }
}
