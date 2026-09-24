import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklyPlan } from './entities/weekly-plan.entity';
import { UserTokens } from '../auth/entities/user-tokens.entity';
import { WeeklyPlansController } from './weekly-plans.controller';
import { WeeklyPlansService } from './weekly-plans.service';

@Module({
  imports: [TypeOrmModule.forFeature([WeeklyPlan, UserTokens])],
  controllers: [WeeklyPlansController],
  providers: [WeeklyPlansService],
  exports: [WeeklyPlansService],
})
export class WeeklyPlansModule {}
