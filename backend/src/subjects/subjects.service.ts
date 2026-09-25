import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Subject } from './entities/subject.entity';
import { Grade } from '../grades/entities/grade.entity';
import { UserTokens } from '../auth/entities/user-tokens.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { ImportSubjectDto } from './dto/import-subject.dto';

/** Créditos por defecto si el syllabus no los menciona. */
const DEFAULT_CREDITOS = 3;

@Injectable()
export class SubjectsService {
  constructor(
    @InjectRepository(Subject)
    private readonly subjectsRepo: Repository<Subject>,
    @InjectRepository(UserTokens)
    private readonly tokensRepo: Repository<UserTokens>,
    private readonly dataSource: DataSource,
  ) {}

  create(dto: CreateSubjectDto): Promise<Subject> {
    const subject = this.subjectsRepo.create(dto);
    return this.subjectsRepo.save(subject);
  }

  findAll(): Promise<Subject[]> {
    return this.subjectsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Subject> {
    const subject = await this.subjectsRepo.findOne({ where: { id } });
    if (!subject) throw new NotFoundException(`No existe la materia ${id}.`);
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<Subject> {
    const subject = await this.findOne(id);
    Object.assign(subject, dto);
    return this.subjectsRepo.save(subject);
  }

  async remove(id: string): Promise<void> {
    const result = await this.subjectsRepo.delete(id);
    if (!result.affected) throw new NotFoundException(`No existe la materia ${id}.`);
  }

  /**
   * Verifica que exista una sesión de Google válida (usuario autenticado).
   * Consistente con el resto de la app (efectivamente monousuario).
   */
  private async requireAuthenticatedUser(): Promise<string> {
    const record = await this.tokensRepo.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });
    if (!record) {
      throw new UnauthorizedException(
        'No hay una sesión de Google válida. Autentícate en /auth/google.',
      );
    }
    return record.googleUserId;
  }

  /**
   * Importa una materia analizada desde un syllabus: crea el Subject y todos
   * sus cortes (Grades) en una única transacción. Los porcentajes/notas se
   * guardan sin nota (calificacionObtenida = null). Si el syllabus no trae
   * créditos, se asigna el valor por defecto (3).
   */
  async importFromSyllabus(dto: ImportSubjectDto): Promise<Subject> {
    // Enlaza al usuario autenticado (valida sesión antes de escribir).
    await this.requireAuthenticatedUser();

    return this.dataSource.transaction(async (manager) => {
      const subject = manager.create(Subject, {
        nombre: dto.materia,
        codigo: dto.codigo ?? undefined,
        creditos: dto.creditos ?? DEFAULT_CREDITOS,
        semestre: dto.semestre ?? undefined,
      });
      const savedSubject = await manager.save(subject);

      const cuts = (dto.evaluaciones ?? [])
        .filter((c) => c.nombreCorte?.trim())
        .map((c) =>
          manager.create(Grade, {
            materiaId: savedSubject.id,
            nombreCorte: c.nombreCorte,
            porcentaje: c.porcentaje ?? 0,
            calificacionObtenida: null,
          }),
        );

      if (cuts.length) {
        await manager.save(cuts);
      }

      // Devuelve la materia con sus cortes recién creados.
      return manager.findOneOrFail(Subject, {
        where: { id: savedSubject.id },
        relations: { grades: true },
      });
    });
  }
}
