import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { CurriculumService } from '../../services/curriculum.service';
import { SubjectsService } from '../../services/subjects.service';
import { extractHttpErrorMessage } from '../../utils/http-error';
import {
  CriticalPathNode,
  CurriculumItem,
  CurriculumStatus,
  SimulateNextSemesterResult,
  Subject,
} from '../../models/api.models';

/** Estado manual guardado localmente por código de materia. */
const STATUS_STORAGE_KEY = 'academicsync_pensum_status';

interface PrereqView {
  /** Alternativas dentro de un mismo requisito (OR). */
  opciones: { codigo: string; nombre: string; aprobado: boolean }[];
  /** true si al menos una alternativa está aprobada. */
  cumplido: boolean;
  /** Texto libre si no se pudo resolver (regla especial). */
  textoLibre?: string;
}

@Component({
  selector: 'app-pensum-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './pensum.page.html',
  styleUrl: './pensum.page.scss',
})
export class PensumPage implements OnInit {
  private curriculumService = inject(CurriculumService);
  private subjectsService = inject(SubjectsService);

  items = signal<CurriculumItem[]>([]);
  creditosPorSemestre = signal<Record<number, number>>({});
  equivalencias = signal<Record<string, string>>({});
  subjects = signal<Subject[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  /** Estado manual por código (persistido en localStorage). */
  private manualStatus = signal<Record<string, CurriculumStatus>>(
    this.loadManualStatus(),
  );

  readonly semestres = [1, 2, 3, 4, 5, 6, 7, 8];
  readonly statusOptions: CurriculumStatus[] = [
    'pendiente',
    'en_curso',
    'aprobada',
  ];

  // --- Drawer de detalle ---
  selected = signal<CurriculumItem | null>(null);
  editMode = signal(false);
  savingDetail = signal(false);
  /** Modelo de edición de la materia seleccionada. */
  editModel: {
    codigo: string;
    nombre: string;
    creditos: number;
    semestre: number;
    area: string;
    prerrequisitos: string[];
  } | null = null;
  newPrereq = '';

  ngOnInit(): void {
    this.load();
    this.subjectsService.findAll().subscribe({
      next: (data) => this.subjects.set(data),
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.curriculumService
      .findAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.creditosPorSemestre.set(res.creditosPorSemestre);
          this.equivalencias.set(res.equivalencias);
        },
        error: (err) =>
          this.error.set(
            extractHttpErrorMessage(err, 'No se pudo cargar el pensum.'),
          ),
      });
  }

  itemsBySemestre(sem: number): CurriculumItem[] {
    return this.items()
      .filter((i) => i.semestre === sem)
      .sort((a, b) => a.orden - b.orden);
  }

  creditosSemestre(sem: number): number {
    // Prioriza el valor oficial del backend; si no, suma los créditos.
    return (
      this.creditosPorSemestre()[sem] ??
      this.itemsBySemestre(sem).reduce((acc, i) => acc + i.creditos, 0)
    );
  }

  // ---- Estado (auto + manual) ----

  /** Normaliza un código para comparar (ISIS2311 ~ ISIS-2311). */
  private normCode(code: string): string {
    return code.replace(/[-\s]/g, '').toUpperCase();
  }

  /** ¿La materia está matriculada actualmente en Subjects? (match por código). */
  private isEnrolled(item: CurriculumItem): boolean {
    const target = this.normCode(item.codigo);
    return this.subjects().some(
      (s) => s.codigo && this.normCode(s.codigo) === target,
    );
  }

  /** Estado efectivo: manual si existe; si no, "en_curso" si está matriculada. */
  statusOf(item: CurriculumItem): CurriculumStatus {
    const manual = this.manualStatus()[item.codigo];
    if (manual) return manual;
    return this.isEnrolled(item) ? 'en_curso' : 'pendiente';
  }

  statusLabel(s: CurriculumStatus): string {
    switch (s) {
      case 'aprobada':
        return 'Aprobada';
      case 'en_curso':
        return 'En curso';
      default:
        return 'Pendiente';
    }
  }

  setStatus(item: CurriculumItem, status: CurriculumStatus): void {
    this.manualStatus.update((cur) => ({ ...cur, [item.codigo]: status }));
    this.persistManualStatus();
  }

  private loadManualStatus(): Record<string, CurriculumStatus> {
    try {
      const raw = localStorage.getItem(STATUS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private persistManualStatus(): void {
    try {
      localStorage.setItem(
        STATUS_STORAGE_KEY,
        JSON.stringify(this.manualStatus()),
      );
    } catch {
      /* ignore */
    }
  }

  /** Clase de color de acento por área. */
  areaClass(area: string): string {
    const map: Record<string, string> = {
      Proyectos: 'area-proyectos',
      'Ciencias de la Computación': 'area-ciencias-comp',
      'Programación y Software': 'area-prog-sw',
      Infraestructura: 'area-infra',
      'Negocios Digitales': 'area-negocios',
      Datos: 'area-datos',
      'Inteligencia Artificial': 'area-ia',
      'Complemento de Ingeniería': 'area-complemento',
      Fundamentos: 'area-fundamentos',
      Electivas: 'area-electivas',
    };
    return map[area] ?? 'area-default';
  }

  // ---- Prerrequisitos (resolución de nombres) ----

  /** Resuelve el nombre de un código contra el pensum o las equivalencias. */
  resolveName(code: string): string {
    const target = this.normCode(code);
    const inPensum = this.items().find((i) => this.normCode(i.codigo) === target);
    if (inPensum) return inPensum.nombre;
    // Equivalencias (códigos antiguos).
    for (const [k, v] of Object.entries(this.equivalencias())) {
      if (this.normCode(k) === target) return v;
    }
    return '';
  }

  /** ¿Un código de prerrequisito está aprobado (manual o matriculado-aprobado)? */
  private isApproved(code: string): boolean {
    const target = this.normCode(code);
    const item = this.items().find((i) => this.normCode(i.codigo) === target);
    if (!item) return false;
    return this.statusOf(item) === 'aprobada';
  }

  /** Construye la vista de prerrequisitos (con alternativas OR y estado). */
  prereqViews(item: CurriculumItem): PrereqView[] {
    return (item.prerrequisitos ?? []).map((req) => {
      // Alternativas separadas por " o " / "/".
      const partes = req.split(/\s+o\s+|\//i).map((p) => p.trim());
      const esCodigoLike = (s: string) => /[A-Za-z]+[-\s]?\d/.test(s);

      if (partes.every((p) => esCodigoLike(p))) {
        const opciones = partes.map((codigo) => {
          const nombre = this.resolveName(codigo);
          return {
            codigo,
            nombre: nombre || '(no está en el pensum)',
            aprobado: this.isApproved(codigo),
          };
        });
        return { opciones, cumplido: opciones.some((o) => o.aprobado) };
      }

      // Regla especial o texto libre (p. ej. "Nivel 1 y 2 aprobados").
      return { opciones: [], cumplido: false, textoLibre: req };
    });
  }

  prereqCountLabel(item: CurriculumItem): string {
    const n = item.prerrequisitos?.length ?? 0;
    if (n === 0) return 'Sin prerrequisitos';
    return n === 1 ? '1 prerrequisito' : `${n} prerrequisitos`;
  }

  // ---- Drawer ----
  openDetail(item: CurriculumItem): void {
    this.selected.set(item);
    this.editMode.set(false);
    this.editModel = null;
    this.newPrereq = '';
  }

  closeDetail(): void {
    this.selected.set(null);
    this.editMode.set(false);
  }

  startEdit(): void {
    const item = this.selected();
    if (!item) return;
    this.editModel = {
      codigo: item.codigo,
      nombre: item.nombre,
      creditos: item.creditos,
      semestre: item.semestre,
      area: item.area,
      prerrequisitos: [...item.prerrequisitos],
    };
    this.editMode.set(true);
  }

  cancelEdit(): void {
    this.editMode.set(false);
    this.editModel = null;
  }

  removePrereq(index: number): void {
    if (!this.editModel) return;
    this.editModel.prerrequisitos.splice(index, 1);
  }

  addPrereq(): void {
    const value = this.newPrereq.trim();
    if (!value || !this.editModel) return;
    this.editModel.prerrequisitos.push(value);
    this.newPrereq = '';
  }

  saveEdit(): void {
    const item = this.selected();
    if (!item || !this.editModel) return;
    this.savingDetail.set(true);
    this.error.set(null);
    this.curriculumService
      .update(item.id, {
        codigo: this.editModel.codigo.trim(),
        nombre: this.editModel.nombre.trim(),
        creditos: Number(this.editModel.creditos) || 0,
        semestre: Number(this.editModel.semestre),
        area: this.editModel.area,
        prerrequisitos: this.editModel.prerrequisitos,
      })
      .pipe(finalize(() => this.savingDetail.set(false)))
      .subscribe({
        next: (updated) => {
          this.items.update((list) =>
            list.map((i) => (i.id === updated.id ? updated : i)),
          );
          this.selected.set(updated);
          this.editMode.set(false);
        },
        error: (err) =>
          this.error.set(
            extractHttpErrorMessage(err, 'No se pudo guardar la materia.'),
          ),
      });
  }

  // ---- Restaurar pensum ----
  restoring = signal(false);
  restore(): void {
    if (
      !confirm(
        '¿Restaurar el pensum al plan original? Se perderán las ediciones de materias y prerrequisitos.',
      )
    ) {
      return;
    }
    this.restoring.set(true);
    this.curriculumService
      .restore()
      .pipe(finalize(() => this.restoring.set(false)))
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.creditosPorSemestre.set(res.creditosPorSemestre);
          this.equivalencias.set(res.equivalencias);
          this.closeDetail();
        },
        error: (err) =>
          this.error.set(
            extractHttpErrorMessage(err, 'No se pudo restaurar el pensum.'),
          ),
      });
  }

  /** Autocompletado de materias del pensum para agregar prerrequisito. */
  autocompleteItems = computed(() =>
    this.items().map((i) => `${i.codigo}`),
  );

  // ============================================================
  //  Proyector de matrícula (próximo semestre)
  // ============================================================
  projectionMode = signal(false);
  projecting = signal(false);
  elegiblesNorm = signal<Set<string>>(new Set());
  elegiblesCount = signal(0);
  creditosSugeridos = signal(0);

  /** Códigos aprobados + en curso (normalizados) para la simulación. */
  private aprobadasYEnCurso(): string[] {
    return this.items()
      .filter((i) => {
        const st = this.statusOf(i);
        return st === 'aprobada' || st === 'en_curso';
      })
      .map((i) => i.codigo);
  }

  toggleProjection(): void {
    if (this.projectionMode()) {
      this.projectionMode.set(false);
      this.elegiblesNorm.set(new Set());
      return;
    }
    this.projecting.set(true);
    this.error.set(null);
    this.curriculumService
      .simulateNextSemester(this.aprobadasYEnCurso())
      .pipe(finalize(() => this.projecting.set(false)))
      .subscribe({
        next: (res: SimulateNextSemesterResult) => {
          this.elegiblesNorm.set(
            new Set(res.elegibles.map((e) => this.normCode(e.codigo))),
          );
          this.elegiblesCount.set(res.totalElegibles);
          this.creditosSugeridos.set(res.creditosSugeridos);
          this.projectionMode.set(true);
        },
        error: (err) =>
          this.error.set(
            extractHttpErrorMessage(err, 'No se pudo proyectar el próximo semestre.'),
          ),
      });
  }

  isElegible(item: CurriculumItem): boolean {
    return (
      this.projectionMode() && this.elegiblesNorm().has(this.normCode(item.codigo))
    );
  }

  // ============================================================
  //  Ruta crítica (grafo de dependencias)
  // ============================================================
  criticalMode = signal(false);
  private criticalData = signal<CriticalPathNode[]>([]);
  /** Materia foco de la ruta crítica (su cadena descendente se resalta). */
  focusCode = signal<string | null>(null);
  private highlightedNorm = signal<Set<string>>(new Set());

  private ensureCriticalData(): void {
    if (this.criticalData().length) return;
    this.curriculumService.criticalPath().subscribe({
      next: (nodes) => this.criticalData.set(nodes),
    });
  }

  toggleCriticalMode(): void {
    this.criticalMode.update((v) => !v);
    if (this.criticalMode()) {
      this.ensureCriticalData();
    } else {
      this.focusCode.set(null);
      this.highlightedNorm.set(new Set());
    }
  }

  /** Nodo de ruta crítica de una materia. */
  criticalNode(item: CurriculumItem): CriticalPathNode | undefined {
    const target = this.normCode(item.codigo);
    return this.criticalData().find((n) => this.normCode(n.codigo) === target);
  }

  impactoCadena(item: CurriculumItem): number {
    return this.criticalNode(item)?.impactoCadena ?? 0;
  }

  /** Enfoca una materia: resalta su cadena descendente. */
  focusCritical(item: CurriculumItem): void {
    const node = this.criticalNode(item);
    if (!node) return;
    this.focusCode.set(item.codigo);
    this.highlightedNorm.set(
      new Set(node.descendientes.map((c) => this.normCode(c))),
    );
  }

  isHighlighted(item: CurriculumItem): boolean {
    return this.highlightedNorm().has(this.normCode(item.codigo));
  }

  isFocus(item: CurriculumItem): boolean {
    return (
      this.focusCode() !== null &&
      this.normCode(this.focusCode()!) === this.normCode(item.codigo)
    );
  }

  /** Materias que desbloquea (nombres completos) — para el drawer. */
  desbloquea(item: CurriculumItem): { codigo: string; nombre: string }[] {
    const node = this.criticalNode(item);
    if (!node) return [];
    return node.descendientes.map((code) => {
      const norm = this.normCode(code);
      const found = this.items().find((i) => this.normCode(i.codigo) === norm);
      return {
        codigo: code,
        nombre: found?.nombre ?? (this.resolveName(code) || code),
      };
    });
  }

  /** ¿La materia está en el camino crítico hacia Proyecto de Grado? */
  enCaminoAGrado(item: CurriculumItem): boolean {
    const node = this.criticalNode(item);
    if (!node) return false;
    return node.descendientes.some((c) => this.normCode(c) === this.normCode('ISIS-3007'));
  }

  /** Al abrir detalle, asegura datos de ruta crítica para el drawer. */
  openDetailWithCritical(item: CurriculumItem): void {
    this.ensureCriticalData();
    if (this.criticalMode()) {
      this.focusCritical(item);
    }
    this.openDetail(item);
  }
}
