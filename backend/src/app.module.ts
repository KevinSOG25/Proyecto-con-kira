import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions } from './config/typeorm.config';
import { Subject } from './subjects/entities/subject.entity';
import { Task } from './tasks/entities/task.entity';
import { Grade } from './grades/entities/grade.entity';
import { UserTokens } from './auth/entities/user-tokens.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
    }),
    // Registro de entidades (los módulos de servicios se añadirán en fases siguientes).
    TypeOrmModule.forFeature([Subject, Task, Grade, UserTokens]),
  ],
})
export class AppModule {}
