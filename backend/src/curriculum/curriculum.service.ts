import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurriculumItem } from './entities/curriculum-item.entity';
import {
  CODIGO_EQUIVALENCIAS,
  CREDITOS_POR_SEMESTRE,
  CURRICULUM_SEED,
} from './curriculum.seed';
import {
  CreateCurriculumItemDto,
  UpdateCurriculumItemDto,
} from './dto/curriculum.dto';

@Injectable()
export class CurriculumService implements OnModuleInit {
  private readonly logger = new Logger(CurriculumService.name);

  constructor(
    @InjectRepository(CurriculumItem)
    private readonly repo: Repository<CurriculumItem>,
  ) {}

  /** Siembra el pensum la primera vez que arranca si la tabla está vacía. */
  async onModuleInit(): Promise<void> {
    try {
      const count = await this.repo.count();
      if (count === 0) {
        await this.seed();
        this.logger.log(`Pensum sembrado con ${CURRICULUM_SEED.length} materias.`);
      }
    } catch (err: any) {
      // No bloquear el arranque si la BD aún no está lista.
      this.logger.warn(`No se pudo sembrar el pensum al iniciar: ${err.message}`);
    }
  }

  /** Inserta la malla curricular oficial (idempotente por código). */
  private async seed(): Promise<void> {
    const items = CURRICULUM_SEED.map((s, index) =>
      this.repo.create({
        codigo: s.codigo,
        nombre: s.nombre,
        creditos: s.creditos,
        semestre: s.semestre,
        area: s.area,
        prerrequisitos: s.prerrequisitos ?? [],
        orden: index,
      }),
    );
    await this.repo.save(items);
  }

  /** Lista todas las materias del pensum + metadatos útiles para el frontend. */
  async findAll() {
    const items = await this.repo.find({
      order: { semestre: 'ASC', orden: 'ASC' },
    });
    return {
      items,
      creditosPorSemestre: CREDITOS_POR_SEMESTRE,
      equivalencias: CODIGO_EQUIVALENCIAS,
    };
  }

  async create(dto: CreateCurriculumItemDto): Promise<CurriculumItem> {
    const exists = await this.repo.findOne({ where: { codigo: dto.codigo } });
    if (exists) {
      throw new ConflictException(`Ya existe una materia con código ${dto.codigo}.`);
    }
    const item = this.repo.create({
      ...dto,
      prerrequisitos: dto.prerrequisitos ?? [],
      orden: dto.orden ?? 999,
    });
    return this.repo.save(item);
  }

  async update(id: string, dto: UpdateCurriculumItemDto): Promise<CurriculumItem> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`No existe la materia ${id} en el pensum.`);

    // Si cambia el código, validar que no colisione con otro.
    if (dto.codigo && dto.codigo !== item.codigo) {
      const clash = await this.repo.findOne({ where: { codigo: dto.codigo } });
      if (clash) {
        throw new ConflictException(`Ya existe una materia con código ${dto.codigo}.`);
      }
    }
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`No existe la materia ${id} en el pensum.`);
    }
  }

  /** Restaura el pensum al estado original del seed (borra y re-siembra). */
  async restore() {
    await this.repo.clear();
    await this.seed();
    this.logger.log('Pensum restaurado al plan original.');
    return this.findAll();
  }
}
