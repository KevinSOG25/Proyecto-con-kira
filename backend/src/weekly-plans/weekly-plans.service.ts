import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { WeeklyPlan } from './entities/weekly-plan.entity';
import { UserTokens } from '../auth/entities/user-tokens.entity';
import { UpsertWeeklyPlanDto } from './dto/upsert-weekly-plan.dto';
import { UpdateWeeklyPlanDto } from './dto/update-weekly-plan.dto';

@Injectable()
export class WeeklyPlansService {
  constructor(
    @InjectRepository(WeeklyPlan)
    private readonly plansRepo: Repository<WeeklyPlan>,
    @InjectRepository(UserTokens)
    private readonly tokensRepo: Repository<UserTokens>,
  ) {}

  /**
   * Resuelve el usuario autenticado. Consistente con GoogleAuthClient:
   * en esta app (efectivamente monousuario) se toma el primer token guardado.
   */
  private async resolveUser(): Promise<string> {
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

  /** Lista las planeaciones del usuario (opcionalmente filtradas por materia). */
  async findAll(materiaId?: string): Promise<WeeklyPlan[]> {
    const googleUserId = await this.resolveUser();
    return this.plansRepo.find({
      where: {
        googleUserId,
        // materiaId undefined -> sin filtro; explícito -> filtra (null = generales).
        ...(materiaId !== undefined
          ? { materiaId: materiaId === 'null' ? IsNull() : materiaId }
          : {}),
      },
      order: { weekNumber: 'ASC' },
    });
  }

  /**
   * Crea o actualiza (upsert) la planeación de una semana concreta.
   * Evita duplicados usando la clave (usuario, materia, semana).
   */
  async upsert(dto: UpsertWeeklyPlanDto): Promise<WeeklyPlan> {
    const googleUserId = await this.resolveUser();
    const materiaId = dto.materiaId ?? null;

    let plan = await this.plansRepo.findOne({
      where: {
        googleUserId,
        materiaId: materiaId === null ? IsNull() : materiaId,
        weekNumber: dto.weekNumber,
      },
    });

    if (plan) {
      plan.content = dto.content;
    } else {
      plan = this.plansRepo.create({
        googleUserId,
        materiaId,
        weekNumber: dto.weekNumber,
        content: dto.content,
      });
    }
    return this.plansRepo.save(plan);
  }

  /** Actualiza el contenido de una planeación existente por id. */
  async update(id: string, dto: UpdateWeeklyPlanDto): Promise<WeeklyPlan> {
    const googleUserId = await this.resolveUser();
    const plan = await this.plansRepo.findOne({ where: { id, googleUserId } });
    if (!plan) {
      throw new NotFoundException(`No existe la planeación ${id}.`);
    }
    plan.content = dto.content;
    return this.plansRepo.save(plan);
  }
}
