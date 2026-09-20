import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CalendarService } from '../calendar/calendar.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private readonly tasksRepo: Repository<Task>,
    @InjectRepository(Subject)
    private readonly subjectsRepo: Repository<Subject>,
    private readonly calendarService: CalendarService,
  ) {}

  /**
   * Crea la tarea y, salvo que se desactive, inserta un evento en
   * Google Calendar guardando el googleEventId. Si la sincronización
   * con Calendar falla, la tarea se crea igualmente (sin bloquear).
   */
  async create(dto: CreateTaskDto): Promise<Task> {
    const subject = await this.subjectsRepo.findOne({
      where: { id: dto.materiaId },
    });
    if (!subject) {
      throw new NotFoundException(`No existe la materia ${dto.materiaId}.`);
    }

    const task = this.tasksRepo.create({
      materiaId: dto.materiaId,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      fechaLimite: new Date(dto.fechaLimite),
      completada: dto.completada ?? false,
    });
    const saved = await this.tasksRepo.save(task);

    if (dto.sincronizarCalendar !== false) {
      try {
        const eventId = await this.calendarService.createEvent({
          titulo: `[${subject.nombre}] ${saved.titulo}`,
          descripcion: saved.descripcion,
          fechaLimite: saved.fechaLimite,
        });
        if (eventId) {
          saved.googleEventId = eventId;
          await this.tasksRepo.save(saved);
        }
      } catch (err: any) {
        this.logger.error(
          `No se pudo crear el evento en Calendar para la tarea ${saved.id}: ${err.message}`,
        );
      }
    }

    return saved;
  }

  findBySubject(materiaId: string): Promise<Task[]> {
    return this.tasksRepo.find({
      where: { materiaId },
      order: { fechaLimite: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.tasksRepo.findOne({
      where: { id },
      relations: { subject: true },
    });
    if (!task) throw new NotFoundException(`No existe la tarea ${id}.`);
    return task;
  }

  /** Actualiza la tarea y sincroniza el evento de Calendar si existe. */
  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);

    if (dto.titulo !== undefined) task.titulo = dto.titulo;
    if (dto.descripcion !== undefined) task.descripcion = dto.descripcion;
    if (dto.fechaLimite !== undefined) task.fechaLimite = new Date(dto.fechaLimite);
    if (dto.completada !== undefined) task.completada = dto.completada;

    const saved = await this.tasksRepo.save(task);

    if (saved.googleEventId) {
      try {
        await this.calendarService.updateEvent(saved.googleEventId, {
          titulo: `[${task.subject?.nombre ?? 'Materia'}] ${saved.titulo}`,
          descripcion: saved.descripcion,
          fechaLimite: saved.fechaLimite,
        });
      } catch (err: any) {
        this.logger.error(
          `No se pudo actualizar el evento en Calendar de la tarea ${saved.id}: ${err.message}`,
        );
      }
    }

    return saved;
  }

  /** Elimina la tarea y su evento de Calendar asociado. */
  async remove(id: string): Promise<void> {
    const task = await this.findOne(id);

    if (task.googleEventId) {
      try {
        await this.calendarService.deleteEvent(task.googleEventId);
      } catch (err: any) {
        this.logger.error(
          `No se pudo eliminar el evento en Calendar de la tarea ${id}: ${err.message}`,
        );
      }
    }

    await this.tasksRepo.delete(id);
  }
}
