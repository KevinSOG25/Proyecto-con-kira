import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Subject]), CalendarModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
