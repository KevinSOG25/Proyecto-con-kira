import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /** Dashboard estadístico: promedio ponderado semestral + notas por materia. */
  @Get('dashboard')
  getDashboard() {
    return this.analyticsService.getDashboard();
  }
}
