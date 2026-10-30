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

  // ============================================================
  //  Proyector de matrícula y ruta crítica
  // ============================================================

  /** Normaliza un código para comparar (ISIS2311 ~ ISIS-2311). */
  private normCode(code: string): string {
    return code.replace(/[-\s]/g, '').toUpperCase();
  }

  /**
   * Evalúa si un único requisito (que puede ser una alternativa "A o B" o
   * una regla especial de texto) está satisfecho dado el set de aprobadas.
   *
   * - Alternativas de código ("ISIS-1511 o ISIS-2304"): basta una aprobada.
   * - "Nivel 1 y 2 aprobados": todas las materias de semestres 1 y 2 aprobadas.
   * - Requisitos de idioma/créditos (RLEC, RIDI): deben estar en aprobadas.
   */
  private requisitoCumplido(
    requisito: string,
    aprobadasNorm: Set<string>,
    allItems: CurriculumItem[],
  ): boolean {
    const texto = requisito.trim();

    // Regla especial: niveles aprobados.
    const nivelMatch = texto.match(/nivel\s+1\s+y\s+2/i);
    if (nivelMatch) {
      const nivel12 = allItems.filter(
        (i) => i.semestre === 1 || i.semestre === 2,
      );
      return nivel12.every((i) => aprobadasNorm.has(this.normCode(i.codigo)));
    }

    // Alternativas separadas por " o " o "/".
    const partes = texto.split(/\s+o\s+|\//i).map((p) => p.trim());
    const codeLike = (s: string) => /[A-Za-z]+[-\s]?\d|^RLEC$|^RIDI$/i.test(s);

    if (partes.every((p) => codeLike(p))) {
      return partes.some((p) => aprobadasNorm.has(this.normCode(p)));
    }

    // Texto no reconocido como código: no se puede verificar automáticamente.
    // Se considera no cumplido para no desbloquear por error.
    return false;
  }

  /** ¿Están TODOS los prerrequisitos de una materia satisfechos? */
  private esElegible(
    item: CurriculumItem,
    aprobadasNorm: Set<string>,
    allItems: CurriculumItem[],
  ): boolean {
    const prereqs = item.prerrequisitos ?? [];
    if (prereqs.length === 0) return true;
    return prereqs.every((r) =>
      this.requisitoCumplido(r, aprobadasNorm, allItems),
    );
  }

  /**
   * Simula el próximo semestre: dadas las materias aprobadas, devuelve las
   * materias pendientes que quedan 100% elegibles para inscribir.
   */
  async simulateNextSemester(aprobadas: string[]) {
    const allItems = await this.repo.find({
      order: { semestre: 'ASC', orden: 'ASC' },
    });

    const aprobadasNorm = new Set((aprobadas ?? []).map((c) => this.normCode(c)));

    const elegibles = allItems.filter((item) => {
      // No sugerir materias ya aprobadas.
      if (aprobadasNorm.has(this.normCode(item.codigo))) return false;
      return this.esElegible(item, aprobadasNorm, allItems);
    });

    const creditosSugeridos = elegibles.reduce((acc, i) => acc + i.creditos, 0);

    return {
      elegibles,
      totalElegibles: elegibles.length,
      creditosSugeridos,
      aprobadasConsideradas: Array.from(aprobadasNorm),
    };
  }

  /**
   * Ruta crítica: para cada materia calcula cuántas materias dependen de ella
   * (directa e indirectamente) — su "impactoCadena".
   */
  async criticalPath() {
    const allItems = await this.repo.find({
      order: { semestre: 'ASC', orden: 'ASC' },
    });

    // Grafo: código -> códigos que lo tienen como prerrequisito (dependientes directos).
    const dependientes = new Map<string, Set<string>>();
    const byNorm = new Map<string, CurriculumItem>();
    for (const item of allItems) {
      byNorm.set(this.normCode(item.codigo), item);
      dependientes.set(this.normCode(item.codigo), new Set());
    }

    for (const item of allItems) {
      for (const req of item.prerrequisitos ?? []) {
        // Extrae todos los códigos mencionados en el requisito (incluye alternativas).
        const partes = req.split(/\s+o\s+|\//i).map((p) => p.trim());
        for (const parte of partes) {
          const norm = this.normCode(parte);
          if (dependientes.has(norm)) {
            dependientes.get(norm)!.add(this.normCode(item.codigo));
          }
        }
      }
    }

    // DFS para obtener descendientes transitivos de cada materia.
    const descendientesDe = (codeNorm: string): Set<string> => {
      const visited = new Set<string>();
      const stack = [...(dependientes.get(codeNorm) ?? [])];
      while (stack.length) {
        const cur = stack.pop()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        for (const next of dependientes.get(cur) ?? []) {
          if (!visited.has(next)) stack.push(next);
        }
      }
      return visited;
    };

    const result = allItems.map((item) => {
      const norm = this.normCode(item.codigo);
      const descendientes = descendientesDe(norm);
      const dependientesDirectos = Array.from(dependientes.get(norm) ?? []).map(
        (n) => byNorm.get(n)?.codigo ?? n,
      );
      return {
        codigo: item.codigo,
        nombre: item.nombre,
        impactoCadena: descendientes.size,
        dependientesDirectos,
        descendientes: Array.from(descendientes).map(
          (n) => byNorm.get(n)?.codigo ?? n,
        ),
      };
    });

    return result;
  }
}
