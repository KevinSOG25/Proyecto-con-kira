import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeeklyPlansService } from '../../services/weekly-plans.service';
import { SubjectsService } from '../../services/subjects.service';
import { Subject, WeeklyPlan } from '../../models/api.models';

const TOTAL_WEEKS = 16;

/** Estados posibles de un entregable por materia. */
export type PlanStatus = 'libre' | 'en_progreso' | 'prioritario' | 'completado';

const STATUS_LABEL: Record<PlanStatus, string> = {
  libre: 'Semana libre',
  en_progreso: 'En progreso',
  prioritario: 'Prioritario',
  completado: 'Completado',
};

/** Marcador textual del estado embebido en la línea serializada. */
const STATUS_TAG: Record<PlanStatus, string> = {
  libre: '[libre]',
  en_progreso: '[en progreso]',
  prioritario: '[prioritario]',
  completado: '[completado]',
};

/** Fila guiada por materia dentro de una semana. */
interface SubjectPlan {
  subjectId: string;
  nombre: string;
  tarea: string;
  estado: PlanStatus;
}

interface WeekState {
  weekNumber: number;
  id: string | null;
  /** Texto plano crudo almacenado en BD (fuente de verdad del contrato). */
  content: string;
  /** Modo de edición: lista guiada o texto clásico. */
  mode: 'guided' | 'raw';
  /** Filas por materia (modo guiado). */
  subjectPlans: SubjectPlan[];
  /** Notas generales no atadas a una materia (modo guiado). */
  generalNotes: string;
  saving: boolean;
  saved: boolean;
}

@Component({
  selector: 'app-planning-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './planning.page.html',
  styleUrl: './planning.page.scss',
})
export class PlanningPage implements OnInit {
  private plansService = inject(WeeklyPlansService);
  private subjectsService = inject(SubjectsService);

  subjects = signal<Subject[]>([]);
  /** '' = planeación general (materiaId null). */
  selectedSubjectId = signal<string>('');
  weeks = signal<WeekState[]>(this.buildEmptyWeeks());
  loading = signal(false);
  error = signal<string | null>(null);

  readonly statusOptions: PlanStatus[] = [
    'libre',
    'en_progreso',
    'prioritario',
    'completado',
  ];

  ngOnInit(): void {
    // Cargamos materias primero; al llegar, reconstruimos las filas guiadas.
    this.subjectsService.findAll().subscribe({
      next: (data) => {
        this.subjects.set(data);
        this.rebuildGuidedFromContent();
      },
    });
    this.loadPlans();
  }

  statusLabel(s: PlanStatus): string {
    return STATUS_LABEL[s];
  }

  private buildEmptyWeeks(): WeekState[] {
    return Array.from({ length: TOTAL_WEEKS }, (_, i) => ({
      weekNumber: i + 1,
      id: null,
      content: '',
      mode: 'guided' as const,
      subjectPlans: [],
      generalNotes: '',
      saving: false,
      saved: false,
    }));
  }

  onSubjectChange(id: string): void {
    this.selectedSubjectId.set(id);
    this.loadPlans();
  }

  /** ¿Estamos en el ámbito general? (solo ahí tiene sentido la lista por materia). */
  isGeneralScope(): boolean {
    return this.selectedSubjectId() === '';
  }

  loadPlans(): void {
    this.loading.set(true);
    this.error.set(null);
    const filter = this.selectedSubjectId() === '' ? 'null' : this.selectedSubjectId();
    const fresh = this.buildEmptyWeeks();
    this.plansService.findAll(filter).subscribe({
      next: (plans: WeeklyPlan[]) => {
        for (const p of plans) {
          const week = fresh.find((w) => w.weekNumber === p.weekNumber);
          if (week) {
            week.id = p.id;
            week.content = p.content ?? '';
          }
        }
        this.weeks.set(fresh);
        this.rebuildGuidedFromContent();
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          'No se pudieron cargar las planeaciones. Verifica tu sesión de Google.',
        );
        this.weeks.set(fresh);
        this.loading.set(false);
      },
    });
  }

  /** Reconstruye las filas guiadas de todas las semanas a partir del content. */
  private rebuildGuidedFromContent(): void {
    const subjects = this.subjects();
    this.weeks.update((list) =>
      list.map((w) => {
        const { subjectPlans, generalNotes } = this.deserialize(w.content, subjects);
        return { ...w, subjectPlans, generalNotes };
      }),
    );
  }

  /** Alterna entre modo lista guiada y texto clásico. */
  toggleMode(week: WeekState): void {
    if (week.mode === 'guided') {
      // Al pasar a texto: serializamos lo guiado al content crudo.
      week.content = this.serialize(week);
      week.mode = 'raw';
    } else {
      // Al volver a guiado: parseamos el texto editado.
      const { subjectPlans, generalNotes } = this.deserialize(
        week.content,
        this.subjects(),
      );
      week.subjectPlans = subjectPlans;
      week.generalNotes = generalNotes;
      week.mode = 'guided';
    }
    this.weeks.update((l) => [...l]);
  }

  /** Botón "Sin pendientes": marca la materia como libre con texto estándar. */
  markNoPending(plan: SubjectPlan): void {
    plan.tarea = 'Sin pendientes';
    plan.estado = 'libre';
    this.weeks.update((l) => [...l]);
  }

  /**
   * Serializa el estado guiado al formato de texto plano compatible:
   *   "Materia = Tarea [estado]"  (una línea por materia con tarea)
   * seguido de las notas generales. Mantiene el contrato existente.
   */
  private serialize(week: WeekState): string {
    const lines: string[] = [];
    for (const p of week.subjectPlans) {
      const tarea = p.tarea.trim();
      // Solo persistimos materias con algo escrito o estado distinto de libre.
      if (!tarea && p.estado === 'libre') continue;
      const estadoTag = STATUS_TAG[p.estado];
      lines.push(`${p.nombre} = ${tarea || 'Pendiente'} ${estadoTag}`.trim());
    }
    let out = lines.join('\n');
    const notes = week.generalNotes.trim();
    if (notes) {
      out = out ? `${out}\n\n${notes}` : notes;
    }
    return out;
  }

  /**
   * Parsea el texto plano de una semana. Las líneas con el patrón
   * "Materia = ..." que coincidan con una materia matriculada rellenan
   * su fila; el resto del texto se considera notas generales.
   */
  private deserialize(
    content: string,
    subjects: Subject[],
  ): { subjectPlans: SubjectPlan[]; generalNotes: string } {
    const subjectPlans: SubjectPlan[] = subjects.map((s) => ({
      subjectId: s.id,
      nombre: s.nombre,
      tarea: '',
      estado: 'libre' as PlanStatus,
    }));

    const leftover: string[] = [];
    const text = content ?? '';

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;

      const eqIdx = line.indexOf('=');
      let matched = false;

      if (eqIdx > 0) {
        const left = line.slice(0, eqIdx).trim();
        let right = line.slice(eqIdx + 1).trim();

        const plan = subjectPlans.find(
          (p) => p.nombre.toLowerCase() === left.toLowerCase(),
        );
        if (plan) {
          const estado = this.extractStatus(right);
          right = estado.text;
          plan.estado = estado.status;
          plan.tarea = right === 'Pendiente' ? '' : right;
          matched = true;
        }
      }

      if (!matched) leftover.push(rawLine);
    }

    return { subjectPlans, generalNotes: leftover.join('\n').trim() };
  }

  /** Extrae un tag de estado embebido (p. ej. "[prioritario]") del texto. */
  private extractStatus(text: string): { text: string; status: PlanStatus } {
    const map: { tag: string; status: PlanStatus }[] = [
      { tag: '[completado]', status: 'completado' },
      { tag: '[prioritario]', status: 'prioritario' },
      { tag: '[en progreso]', status: 'en_progreso' },
      { tag: '[libre]', status: 'libre' },
    ];
    for (const { tag, status } of map) {
      const idx = text.toLowerCase().lastIndexOf(tag);
      if (idx >= 0) {
        const cleaned = (text.slice(0, idx) + text.slice(idx + tag.length)).trim();
        return { text: cleaned || 'Pendiente', status };
      }
    }
    return { text, status: 'en_progreso' };
  }

  saveWeek(week: WeekState): void {
    week.saving = true;
    week.saved = false;
    this.error.set(null);

    // En modo guiado, serializamos antes de enviar; en raw usamos el content tal cual.
    const content =
      week.mode === 'guided' ? this.serialize(week) : week.content;
    week.content = content;

    const materiaId =
      this.selectedSubjectId() === '' ? undefined : this.selectedSubjectId();

    this.plansService
      .upsert({ weekNumber: week.weekNumber, content, materiaId })
      .subscribe({
        next: (saved) => {
          week.id = saved.id;
          week.saving = false;
          week.saved = true;
          this.weeks.update((list) => [...list]);
          setTimeout(() => {
            week.saved = false;
            this.weeks.update((list) => [...list]);
          }, 2000);
        },
        error: () => {
          week.saving = false;
          this.error.set(
            `No se pudo guardar la semana ${week.weekNumber}. Verifica tu sesión de Google.`,
          );
        },
      });
  }

  /** ¿La semana tiene contenido guardado o pendiente? (para el badge). */
  weekHasContent(week: WeekState): boolean {
    if (week.mode === 'raw') return week.content.trim().length > 0;
    return (
      week.generalNotes.trim().length > 0 ||
      week.subjectPlans.some((p) => p.tarea.trim() || p.estado !== 'libre')
    );
  }

  trackWeek(_: number, w: WeekState): number {
    return w.weekNumber;
  }
}
