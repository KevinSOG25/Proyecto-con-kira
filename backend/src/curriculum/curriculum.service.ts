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
import { DegreeAudit } from './entities/degree-audit.entity';
import { UserTokens } from '../auth/entities/user-tokens.entity';
import {
  CODIGO_EQUIVALENCIAS,
  CREDITOS_POR_SEMESTRE,
  CREDITOS_TOTALES,
  CURRICULUM_SEED,
} from './curriculum.seed';
import {
  CreateCurriculumItemDto,
  ProjectSemesterDto,
  UpdateCurriculumItemDto,
  UpdateDegreeAuditDto,
} from './dto/curriculum.dto';
import { Type } from '@google/genai';
import { GeminiService } from '../gemini/gemini.service';
import {
  CREDITOS_POSGRADO_OBJETIVO,
  DISC_COURSES,
  MAESTRIAS,
} from './disc-courses.seed';

@Injectable()
export class CurriculumService implements OnModuleInit {
  private readonly logger = new Logger(CurriculumService.name);

  constructor(
    @InjectRepository(CurriculumItem)
    private readonly repo: Repository<CurriculumItem>,
    @InjectRepository(DegreeAudit)
    private readonly auditRepo: Repository<DegreeAudit>,
    @InjectRepository(UserTokens)
    private readonly tokensRepo: Repository<UserTokens>,
    private readonly gemini: GeminiService,
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

  // ============================================================
  //  Auditor de grado (requisitos transversales + progreso)
  // ============================================================

  /** Resuelve el usuario autenticado (monousuario: primer token). */
  private async resolveUser(): Promise<string> {
    const record = await this.tokensRepo.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });
    // Si no hay sesión, usamos un identificador por defecto para no romper
    // la funcionalidad local (el auditor es gestión personal del estudiante).
    return record?.googleUserId ?? 'local-user';
  }

  /** Obtiene (o crea) la fila de auditoría del usuario. */
  private async getOrCreateAudit(googleUserId: string): Promise<DegreeAudit> {
    let audit = await this.auditRepo.findOne({ where: { googleUserId } });
    if (!audit) {
      audit = this.auditRepo.create({ googleUserId });
      audit = await this.auditRepo.save(audit);
    }
    return audit;
  }

  /**
   * Devuelve el auditor de grado: requisitos transversales + progreso global
   * calculado con los códigos de materias aprobadas que envíe el frontend.
   */
  async getDegreeAudit(aprobadas: string[] = [], enCurso: string[] = []) {
    const googleUserId = await this.resolveUser();
    const audit = await this.getOrCreateAudit(googleUserId);
    const progreso = await this.computeProgress(aprobadas, enCurso);
    return { audit, progreso, creditosTotales: CREDITOS_TOTALES };
  }

  /** Actualiza los requisitos transversales y recalcula el progreso. */
  async updateDegreeAudit(dto: UpdateDegreeAuditDto) {
    const googleUserId = await this.resolveUser();
    const audit = await this.getOrCreateAudit(googleUserId);

    if (dto.rlecAprobado !== undefined) audit.rlecAprobado = dto.rlecAprobado;
    if (dto.ridiAprobado !== undefined) audit.ridiAprobado = dto.ridiAprobado;
    if (dto.cursoTipoE1 !== undefined) audit.cursoTipoE1 = dto.cursoTipoE1;
    if (dto.cursoTipoE2 !== undefined) audit.cursoTipoE2 = dto.cursoTipoE2;
    if (dto.cursoTipoEpsilon !== undefined)
      audit.cursoTipoEpsilon = dto.cursoTipoEpsilon;
    if (dto.internacionalizacion !== undefined)
      audit.internacionalizacion = dto.internacionalizacion;

    const saved = await this.auditRepo.save(audit);
    const progreso = await this.computeProgress(
      dto.aprobadas ?? [],
      dto.enCurso ?? [],
    );
    return { audit: saved, progreso, creditosTotales: CREDITOS_TOTALES };
  }

  /**
   * Calcula el progreso global de carrera con base en los códigos aprobados
   * y en curso.
   * - créditos aprobados / en curso / totales (134) y % de avance,
   * - conteo de CBUs y CLEs completados,
   * - elegibilidad para Proyecto de Grado (nivel 1 y 2 aprobados).
   */
  private async computeProgress(aprobadas: string[], enCurso: string[] = []) {
    const allItems = await this.repo.find();
    const aprobadasNorm = new Set((aprobadas ?? []).map((c) => this.normCode(c)));
    const enCursoNorm = new Set((enCurso ?? []).map((c) => this.normCode(c)));

    const esAprobada = (item: CurriculumItem) =>
      aprobadasNorm.has(this.normCode(item.codigo));
    const esEnCurso = (item: CurriculumItem) =>
      !esAprobada(item) && enCursoNorm.has(this.normCode(item.codigo));

    const creditosAprobados = allItems
      .filter(esAprobada)
      .reduce((acc, i) => acc + i.creditos, 0);

    const creditosEnCurso = allItems
      .filter(esEnCurso)
      .reduce((acc, i) => acc + i.creditos, 0);

    const porcentajeAvance = Number(
      ((creditosAprobados / CREDITOS_TOTALES) * 100).toFixed(1),
    );
    const porcentajeEnCurso = Number(
      ((creditosEnCurso / CREDITOS_TOTALES) * 100).toFixed(1),
    );

    // CBUs: códigos que empiezan por CBU, CBCC, CBPC, CBCA, CBCO.
    const esCBU = (c: string) =>
      /^(CBU|CBCC|CBPC|CBCA|CBCO)/i.test(c.replace(/[-\s]/g, ''));
    const cbus = allItems.filter((i) => esCBU(i.codigo));
    const cbusCompletados = cbus.filter(esAprobada).length;

    // CLEs 1..6.
    const esCLE = (c: string) => /^CLE/i.test(c.replace(/[-\s]/g, ''));
    const cles = allItems.filter((i) => esCLE(i.codigo));
    const clesCompletados = cles.filter(esAprobada).length;

    // Elegibilidad Proyecto de Grado: nivel 1 y 2 aprobados.
    const nivel12 = allItems.filter((i) => i.semestre === 1 || i.semestre === 2);
    const nivel12Aprobados = nivel12.filter(esAprobada).length;
    const elegibleProyectoGrado =
      nivel12.length > 0 && nivel12Aprobados === nivel12.length;

    return {
      creditosAprobados,
      creditosEnCurso,
      creditosTotales: CREDITOS_TOTALES,
      porcentajeAvance,
      porcentajeEnCurso,
      cbusTotales: cbus.length,
      cbusCompletados,
      clesTotales: cles.length,
      clesCompletados,
      nivel12Totales: nivel12.length,
      nivel12Aprobados,
      elegibleProyectoGrado,
    };
  }

  // ============================================================
  //  Proyección del próximo semestre con IA (Gemini)
  // ============================================================

  /**
   * Usa Gemini para proponer una combinación balanceada de materias para el
   * próximo semestre, respetando prerrequisitos, ruta crítica y carga objetivo.
   */
  async projectWithGemini(dto: ProjectSemesterDto) {
    const aprobadas = dto.aprobadas ?? [];
    const enCurso = dto.enCurso ?? [];
    const creditosObjetivo = dto.creditosObjetivo ?? 17;

    // 1) Materias elegibles (aprobadas + en curso cuentan como cursadas).
    const { elegibles } = await this.simulateNextSemester([
      ...aprobadas,
      ...enCurso,
    ]);

    // 2) Impacto de ruta crítica para informar a la IA.
    const critical = await this.criticalPath();
    const impactoMap = new Map(
      critical.map((c) => [this.normCode(c.codigo), c.impactoCadena]),
    );

    if (elegibles.length === 0) {
      return {
        materias: [],
        creditosTotales: 0,
        justificacion:
          'No hay materias elegibles por prerrequisitos. Verifica tus materias aprobadas y en curso.',
        generadoPorIA: false,
      };
    }

    // 3) Catálogo compacto de candidatas para el prompt.
    const candidatas = elegibles.map((e) => ({
      codigo: e.codigo,
      nombre: e.nombre,
      creditos: e.creditos,
      semestre: e.semestre,
      area: e.area,
      impactoCadena: impactoMap.get(this.normCode(e.codigo)) ?? 0,
    }));

    const systemInstruction = `Eres un consejero académico experto del programa de Ingeniería de Sistemas y Computación.
Debes proponer la mejor combinación de materias para el PRÓXIMO SEMESTRE del estudiante.
Reglas:
- Responde ÚNICAMENTE con el JSON del esquema, sin texto adicional.
- Elige materias SOLO de la lista de candidatas (todas ya cumplen prerrequisitos).
- Apunta a una carga total cercana a ${creditosObjetivo} créditos (no la excedas en más de 1 crédito).
- Prioriza materias con mayor "impactoCadena" (desbloquean más materias futuras / están en la ruta crítica).
- Evita sobrecarga: equilibra materias difíciles (área Ciencias de la Computación, Programación y Software) con electivas/CBU/CLE más ligeras.
- Si hay espacio, sugiere electivas (EP), CBU o CLE para balancear.
- En "justificacion" explica pedagógicamente por qué esa combinación (máx 5 frases).`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        materias: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              codigo: { type: Type.STRING },
              nombre: { type: Type.STRING },
              creditos: { type: Type.NUMBER },
              razon: { type: Type.STRING },
            },
            required: ['codigo', 'nombre', 'creditos'],
          },
        },
        creditosTotales: { type: Type.NUMBER },
        justificacion: { type: Type.STRING },
      },
      required: ['materias', 'justificacion'],
    };

    const prompt = `Candidatas (ya elegibles por prerrequisitos):
${JSON.stringify(candidatas, null, 2)}

Créditos objetivo del semestre: ${creditosObjetivo}.
Propón la mejor combinación balanceada.`;

    // Generación de baja latencia: timeout estricto 20s + fallback inmediato
    // (Groq o Gemini secundario). Devuelve el proveedor que resolvió.
    const { data: result, provider } = await this.gemini.generateJsonFast<{
      materias: {
        codigo: string;
        nombre: string;
        creditos: number;
        razon?: string;
      }[];
      creditosTotales?: number;
      justificacion: string;
    }>(systemInstruction, prompt, schema as any);

    // Recalcula el total de créditos de forma fiable en el backend.
    const creditosTotales = (result.materias ?? []).reduce(
      (acc, m) => acc + (Number(m.creditos) || 0),
      0,
    );

    return {
      ...result,
      creditosTotales,
      creditosObjetivo,
      generadoPorIA: true,
      provider,
    };
  }

  // ============================================================
  //  Catálogo DISC (posgrado / coterminal)
  // ============================================================

  /** Devuelve el catálogo de cursos de posgrado + maestrías. */
  discCatalog() {
    return {
      cursos: DISC_COURSES,
      maestrias: MAESTRIAS,
      creditosPosgradoObjetivo: CREDITOS_POSGRADO_OBJETIVO,
    };
  }
}
