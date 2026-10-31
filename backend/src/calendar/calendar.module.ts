import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CalendarService } from './calendar.service';
import { CalendarActivity } from './entities/calendar-activity.entity';
import { UserTokens } from '../auth/entities/user-tokens.entity';
import { CalendarActivitiesService } from './calendar-activities.service';
import { CalendarActivitiesController } from './calendar-activities.controller';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([CalendarActivity, UserTokens]),
  ],
  controllers: [CalendarActivitiesController],
  providers: [CalendarService, CalendarActivitiesService],
  exports: [CalendarService, CalendarActivitiesService],
})
export class CalendarModule {}
