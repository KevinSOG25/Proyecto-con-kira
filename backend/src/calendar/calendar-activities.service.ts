import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarActivity } from './entities/calendar-activity.entity';
import { UserTokens } from '../auth/entities/user-tokens.entity';
import { CalendarService } from './calendar.service';
import {
  CreateCalendarActivityDto,
  UpdateCalendarActivityDto,
} from './dto/calendar-activity.dto';

@Injectable()
export class CalendarActivitiesService {
  private readonly logger = new Logger(CalendarActivitiesService.name);

  constructor(
    @InjectRepository(CalendarActivity)
    private readonly repo: Repository<CalendarActivity>,
    @InjectRepository(UserTokens)
    private readonly tokensRepo: Repository<UserTokens>,
    private readonly calendarService: CalendarService,
  ) {}

  /** Usuario autenticado (monousuario: primer token) o 'local-user'. */
  private async resolveUser(): Promise<string> {
    const record = await this.tokensRepo.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });
    return record?.googleUserId ?? 'local-user';
  }

  /** Lista las actividades locales del usuario (opcional rango de fechas). */
  async findAll(desde?: string, hasta?: string): Promise<CalendarActivity[]> {
    const googleUserId = await this.resolveUser();
    const all = await this.repo.find({
      where: { googleUserId },
      order: { inicio: 'ASC' },
    });
    if (!desde && !hasta) return all;
    const d = desde ? new Date(desde).getTime() : -Infinity;
    const h = hasta ? new Date(hasta).getTime() : Infinity;
    return all.filter((a) => {
      const t = new Date(a.inicio).getTime();
      return t >= d && t <= h;
    });
  }

  /**
   * Lista eventos de Google Calendar en el rango dado. Si no hay sesión de
   * Google válida, devuelve [] en vez de propagar el error (modo degradado).
   */
  async findGoogleEvents(desde?: string, hasta?: string) {
    const from = desde ? new Date(desde) : new Date();
    const to = hasta
      ? new Date(hasta)
      : new Date(from.getTime() + 60 * 24 * 60 * 60 * 1000);
    try {
      return await this.calendarService.listEvents(from, to);
    } catch (err: any) {
      this.logger.warn(
        `No se pudieron listar eventos de Google Calendar: ${err.message}`,
      );
      return [];
    }
  }

  async create(dto: CreateCalendarActivityDto): Promise<CalendarActivity> {
    const googleUserId = await this.resolveUser();
    const destino = dto.destino ?? 'local';

    const activity = this.repo.create({
      googleUserId,
      titulo: dto.titulo,
      materiaId: dto.materiaId ?? null,
      materiaLabel: dto.materiaLabel ?? null,
      tipo: dto.tipo ?? 'Otro',
      inicio: new Date(dto.inicio),
      fin: new Date(dto.fin),
      destino,
      googleEventId: null,
    });

    // Replica a Google Calendar si corresponde (no bloquea si falla).
    if (destino === 'google' || destino === 'ambos') {
      try {
        const start = new Date(dto.inicio);
        const end = new Date(dto.fin);
        const duracionMin = Math.max(
          15,
          Math.round((end.getTime() - start.getTime()) / 60_000),
        );
        const eventId = await this.calendarService.createEvent({
          titulo: dto.materiaLabel
            ? `[${dto.materiaLabel}] ${dto.titulo}`
            : dto.titulo,
          descripcion: `Actividad (${dto.tipo ?? 'Otro'}) · AcademicSync`,
          fechaLimite: start,
          duracionMin,
        });
        activity.googleEventId = eventId ?? null;
      } catch (err: any) {
        this.logger.error(
          `No se pudo replicar la actividad en Google Calendar: ${err.message}`,
        );
      }
    }

    return this.repo.save(activity);
  }

  async update(
    id: string,
    dto: UpdateCalendarActivityDto,
  ): Promise<CalendarActivity> {
    const googleUserId = await this.resolveUser();
    const activity = await this.repo.findOne({ where: { id, googleUserId } });
    if (!activity) throw new NotFoundException(`No existe la actividad ${id}.`);

    if (dto.titulo !== undefined) activity.titulo = dto.titulo;
    if (dto.materiaId !== undefined) activity.materiaId = dto.materiaId;
    if (dto.materiaLabel !== undefined) activity.materiaLabel = dto.materiaLabel;
    if (dto.tipo !== undefined) activity.tipo = dto.tipo;
    if (dto.inicio !== undefined) activity.inicio = new Date(dto.inicio);
    if (dto.fin !== undefined) activity.fin = new Date(dto.fin);

    // Sincroniza el evento en Google si existe.
    if (activity.googleEventId) {
      try {
        const duracionMin = Math.max(
          15,
          Math.round(
            (new Date(activity.fin).getTime() -
              new Date(activity.inicio).getTime()) /
              60_000,
          ),
        );
        await this.calendarService.updateEvent(activity.googleEventId, {
          titulo: activity.materiaLabel
            ? `[${activity.materiaLabel}] ${activity.titulo}`
            : activity.titulo,
          descripcion: `Actividad (${activity.tipo}) · AcademicSync`,
          fechaLimite: new Date(activity.inicio),
          duracionMin,
        });
      } catch (err: any) {
        this.logger.error(
          `No se pudo actualizar el evento en Google Calendar: ${err.message}`,
        );
      }
    }

    return this.repo.save(activity);
  }

  async remove(id: string): Promise<void> {
    const googleUserId = await this.resolveUser();
    const activity = await this.repo.findOne({ where: { id, googleUserId } });
    if (!activity) throw new NotFoundException(`No existe la actividad ${id}.`);

    if (activity.googleEventId) {
      try {
        await this.calendarService.deleteEvent(activity.googleEventId);
      } catch (err: any) {
        this.logger.error(
          `No se pudo eliminar el evento en Google Calendar: ${err.message}`,
        );
      }
    }
    await this.repo.delete(id);
  }
}
