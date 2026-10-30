import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumItem } from './entities/curriculum-item.entity';
import { DegreeAudit } from './entities/degree-audit.entity';
import { UserTokens } from '../auth/entities/user-tokens.entity';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';

@Module({
  imports: [TypeOrmModule.forFeature([CurriculumItem, DegreeAudit, UserTokens])],
  controllers: [CurriculumController],
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
