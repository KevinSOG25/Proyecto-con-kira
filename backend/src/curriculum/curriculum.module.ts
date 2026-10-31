import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumItem } from './entities/curriculum-item.entity';
import { DegreeAudit } from './entities/degree-audit.entity';
import { SemesterHistory } from './entities/semester-history.entity';
import { ApprovedCourse } from './entities/approved-course.entity';
import { UserTokens } from '../auth/entities/user-tokens.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { Grade } from '../grades/entities/grade.entity';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';
import { SemesterService } from './semester.service';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CurriculumItem,
      DegreeAudit,
      SemesterHistory,
      ApprovedCourse,
      UserTokens,
      Subject,
      Grade,
    ]),
    GeminiModule,
  ],
  controllers: [CurriculumController],
  providers: [CurriculumService, SemesterService],
  exports: [CurriculumService, SemesterService],
})
export class CurriculumModule {}
