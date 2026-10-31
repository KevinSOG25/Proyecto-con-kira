import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CalendarActivitiesService } from './calendar-activities.service';
import {
  CreateCalendarActivityDto,
  UpdateCalendarActivityDto,
} from './dto/calendar-activity.dto';

@Controller('calendar-activities')
export class CalendarActivitiesController {
  constructor(private readonly service: CalendarActivitiesService) {}

  @Get()
  findAll(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.service.findAll(desde, hasta);
  }

  /** Eventos de Google Calendar del usuario (para las vistas Google/Ambos). */
  @Get('google')
  findGoogle(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.service.findGoogleEvents(desde, hasta);
  }

  @Post()
  create(@Body() dto: CreateCalendarActivityDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalendarActivityDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
