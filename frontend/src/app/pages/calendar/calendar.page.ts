import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubjectsService } from '../../services/subjects.service';
import { Subject } from '../../models/api.models';
import {
  ActivityDestino,
  ActivityTipo,
  CalendarActivitiesService,
  CalendarActivity,
  CreateCalendarActivity,
  GoogleEvent,
} from '../../services/calendar-activities.service';

type ViewMode = 'month' | 'week';
type SourceMode = 'local' | 'google' | 'ambos';

/** Paleta vibrante para asignar color estable por materia. */
const PALETTE = [
  '#ef4444', // rojo
  '#f97316', // naranja
  '#f59e0b', // ámbar
  '#10b981', // esmeralda
  '#06b6d4', // cian
  '#3b82f6', // azul
  '#6366f1', // índigo
  '#8b5cf6', // violeta
  '#ec4899', // rosa
  '#14b8a6', // teal
];

const GOOGLE_COLOR = '#22c55e';
const GENERAL_COLOR = '#64748b';

/** Evento unificado para pintar en la grilla. */
export interface CalEvent {
  id: string;
  titulo: string;
  tipo: string;
  inicio: Date;
  fin: Date;
  color: string;
  source: 'local' | 'google';
  materiaLabel: string | null;
  raw?: CalendarActivity;
}

interface DayCell {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  events: CalEvent[];
}

const TIPOS: ActivityTipo[] = [
  'Parcial',
  'Quiz',
  'Entrega',
  'Laboratorio',
  'Estudio',
  'Otro',
];

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

@Component({
  selector: 'app-calendar-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar.page.html',
  styleUrl: './calendar.page.scss',
})
export class CalendarPage implements OnInit {
  private activitiesService = inject(CalendarActivitiesService);
  private subjectsService = inject(SubjectsService);

  readonly tipos = TIPOS;
  readonly diasSemana = DIAS;
  /** Franja horaria visible en vista semana (7:00 – 21:00). */
  readonly horas = Array.from({ length: 15 }, (_, i) => i + 7);

  subjects = signal<Subject[]>([]);
  activities = signal<CalendarActivity[]>([]);
  googleEvents = signal<GoogleEvent[]>([]);

  view = signal<ViewMode>('month');
  source = signal<SourceMode>('ambos');
  cursor = signal<Date>(this.startOfDay(new Date()));

  loading = signal(false);
  error = signal<string | null>(null);

  // --- Modal de creación / edición ---
  modalOpen = signal(false);
  editingId = signal<string | null>(null);
  form = signal<{
    titulo: string;
    materiaId: string; // '' = General / Personal
    tipo: ActivityTipo;
    fecha: string; // yyyy-MM-dd
    horaInicio: string; // HH:mm
    horaFin: string; // HH:mm
    destino: ActivityDestino;
  }>(this.blankForm());
  saving = signal(false);

  // ---------- Ciclo de vida ----------
  ngOnInit(): void {
    this.subjectsService.findAll().subscribe({
      next: (s) => this.subjects.set(s),
    });
    this.reload();
  }

  // ---------- Carga de datos ----------
  reload(): void {
    const { desde, hasta } = this.rangeIso();
    this.loading.set(true);
    this.error.set(null);

    this.activitiesService.findAll(desde, hasta).subscribe({
      next: (data) => {
        this.activities.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las actividades locales.');
        this.loading.set(false);
      },
    });

    if (this.source() !== 'local') {
      this.activitiesService.findGoogleEvents(desde, hasta).subscribe({
        next: (data) => this.googleEvents.set(data),
        error: () => this.googleEvents.set([]),
      });
    } else {
      this.googleEvents.set([]);
    }
  }

  /** Rango ISO amplio que cubre el mes/semana visible con margen. */
  private rangeIso(): { desde: string; hasta: string } {
    const c = this.cursor();
    const desde = new Date(c.getFullYear(), c.getMonth() - 1, 1);
    const hasta = new Date(c.getFullYear(), c.getMonth() + 2, 0, 23, 59, 59);
    return { desde: desde.toISOString(), hasta: hasta.toISOString() };
  }

  // ---------- Color por materia ----------
  colorForLabel(label: string | null): string {
    if (!label) return GENERAL_COLOR;
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = (hash * 31 + label.charCodeAt(i)) & 0xffffffff;
    }
    return PALETTE[Math.abs(hash) % PALETTE.length];
  }

  // ---------- Eventos unificados ----------
  readonly eventos = computed<CalEvent[]>(() => {
    const out: CalEvent[] = [];
    const src = this.source();

    if (src !== 'google') {
      for (const a of this.activities()) {
        out.push({
          id: a.id,
          titulo: a.titulo,
          tipo: a.tipo,
          inicio: new Date(a.inicio),
          fin: new Date(a.fin),
          color: this.colorForLabel(a.materiaLabel),
          source: 'local',
          materiaLabel: a.materiaLabel,
          raw: a,
        });
      }
    }

    if (src !== 'local') {
      for (const g of this.googleEvents()) {
        if (!g.inicio) continue;
        const inicio = new Date(g.inicio);
        const fin = g.fin ? new Date(g.fin) : new Date(inicio.getTime() + 3600_000);
        out.push({
          id: `g:${g.id}`,
          titulo: g.titulo,
          tipo: 'Google',
          inicio,
          fin,
          color: GOOGLE_COLOR,
          source: 'google',
          materiaLabel: null,
        });
      }
    }
    return out;
  });

  /** Leyenda de materias con su color (solo las que tienen actividades). */
  readonly leyenda = computed(() => {
    const map = new Map<string, string>();
    for (const e of this.eventos()) {
      if (e.source === 'local' && e.materiaLabel) {
        map.set(e.materiaLabel, e.color);
      }
    }
    const items = Array.from(map, ([label, color]) => ({ label, color }));
    if (this.source() !== 'local') {
      items.push({ label: 'Google Calendar', color: GOOGLE_COLOR });
    }
    return items;
  });

  // ---------- Vista Mes ----------
  readonly monthLabel = computed(() => {
    const c = this.cursor();
    return `${MESES[c.getMonth()]} ${c.getFullYear()}`;
  });

  readonly monthGrid = computed<DayCell[]>(() => {
    const c = this.cursor();
    const first = new Date(c.getFullYear(), c.getMonth(), 1);
    // Lunes como inicio de semana.
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);

    const today = this.startOfDay(new Date());
    const evs = this.eventos();
    const cells: DayCell[] = [];

    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dayEvents = evs
        .filter((e) => this.sameDay(e.inicio, date))
        .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
      cells.push({
        date,
        inMonth: date.getMonth() === c.getMonth(),
        isToday: this.sameDay(date, today),
        events: dayEvents,
      });
    }
    return cells;
  });

  // ---------- Vista Semana ----------
  readonly weekDays = computed<DayCell[]>(() => {
    const c = this.cursor();
    const offset = (c.getDay() + 6) % 7;
    const monday = new Date(c);
    monday.setDate(c.getDate() - offset);
    const today = this.startOfDay(new Date());
    const evs = this.eventos();

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dayEvents = evs
        .filter((e) => this.sameDay(e.inicio, date))
        .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
      return {
        date,
        inMonth: true,
        isToday: this.sameDay(date, today),
        events: dayEvents,
      };
    });
  });

  readonly weekLabel = computed(() => {
    const days = this.weekDays();
    if (!days.length) return '';
    const a = days[0].date;
    const b = days[6].date;
    return `${a.getDate()} ${MESES[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MESES[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
  });

  /** Posición vertical (%) de un evento dentro de la columna de la semana. */
  eventTop(e: CalEvent): number {
    const minutes = e.inicio.getHours() * 60 + e.inicio.getMinutes();
    const base = 7 * 60;
    const total = this.horas.length * 60;
    return Math.max(0, ((minutes - base) / total) * 100);
  }

  eventHeight(e: CalEvent): number {
    const dur = Math.max(30, (e.fin.getTime() - e.inicio.getTime()) / 60_000);
    const total = this.horas.length * 60;
    return Math.min(100, (dur / total) * 100);
  }

  // ---------- Navegación ----------
  setView(v: ViewMode): void {
    this.view.set(v);
  }

  setSource(s: SourceMode): void {
    this.source.set(s);
    this.reload();
  }

  hoy(): void {
    this.cursor.set(this.startOfDay(new Date()));
    this.reload();
  }

  prev(): void {
    const c = new Date(this.cursor());
    if (this.view() === 'month') c.setMonth(c.getMonth() - 1);
    else c.setDate(c.getDate() - 7);
    this.cursor.set(this.startOfDay(c));
    this.reload();
  }

  next(): void {
    const c = new Date(this.cursor());
    if (this.view() === 'month') c.setMonth(c.getMonth() + 1);
    else c.setDate(c.getDate() + 7);
    this.cursor.set(this.startOfDay(c));
    this.reload();
  }

  // ---------- Modal ----------
  private blankForm() {
    return {
      titulo: '',
      materiaId: '',
      tipo: 'Otro' as ActivityTipo,
      fecha: this.toDateInput(new Date()),
      horaInicio: '08:00',
      horaFin: '09:00',
      destino: 'local' as ActivityDestino,
    };
  }

  openCreate(date?: Date): void {
    const f = this.blankForm();
    if (date) f.fecha = this.toDateInput(date);
    this.form.set(f);
    this.editingId.set(null);
    this.modalOpen.set(true);
  }

  openEdit(e: CalEvent): void {
    if (e.source !== 'local' || !e.raw) return; // Google no se edita aquí
    const a = e.raw;
    this.form.set({
      titulo: a.titulo,
      materiaId: a.materiaId ?? '',
      tipo: (a.tipo as ActivityTipo) ?? 'Otro',
      fecha: this.toDateInput(new Date(a.inicio)),
      horaInicio: this.toTimeInput(new Date(a.inicio)),
      horaFin: this.toTimeInput(new Date(a.fin)),
      destino: (a.destino as ActivityDestino) ?? 'local',
    });
    this.editingId.set(a.id);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.saving.set(false);
  }

  canSave(): boolean {
    const f = this.form();
    return !!f.titulo.trim() && !!f.fecha && f.horaInicio < f.horaFin;
  }

  save(): void {
    if (!this.canSave()) return;
    const f = this.form();
    const subject = this.subjects().find((s) => s.id === f.materiaId);
    const materiaLabel = subject
      ? subject.codigo
        ? `${subject.codigo} · ${subject.nombre}`
        : subject.nombre
      : null;

    const inicio = new Date(`${f.fecha}T${f.horaInicio}:00`).toISOString();
    const fin = new Date(`${f.fecha}T${f.horaFin}:00`).toISOString();

    this.saving.set(true);
    const editId = this.editingId();

    if (editId) {
      this.activitiesService
        .update(editId, {
          titulo: f.titulo.trim(),
          materiaId: f.materiaId || null,
          materiaLabel,
          tipo: f.tipo,
          inicio,
          fin,
        })
        .subscribe({
          next: () => {
            this.closeModal();
            this.reload();
          },
          error: () => {
            this.saving.set(false);
            this.error.set('No se pudo actualizar la actividad.');
          },
        });
    } else {
      const dto: CreateCalendarActivity = {
        titulo: f.titulo.trim(),
        materiaId: f.materiaId || null,
        materiaLabel,
        tipo: f.tipo,
        inicio,
        fin,
        destino: f.destino,
      };
      this.activitiesService.create(dto).subscribe({
        next: () => {
          this.closeModal();
          this.reload();
        },
        error: () => {
          this.saving.set(false);
          this.error.set('No se pudo crear la actividad.');
        },
      });
    }
  }

  remove(): void {
    const id = this.editingId();
    if (!id) return;
    if (!confirm('¿Eliminar esta actividad?')) return;
    this.saving.set(true);
    this.activitiesService.remove(id).subscribe({
      next: () => {
        this.closeModal();
        this.reload();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('No se pudo eliminar la actividad.');
      },
    });
  }

  updateForm<K extends keyof ReturnType<typeof this.blankForm>>(
    key: K,
    value: ReturnType<typeof this.blankForm>[K],
  ): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  // ---------- Helpers de fecha ----------
  private startOfDay(d: Date): Date {
    const n = new Date(d);
    n.setHours(0, 0, 0, 0);
    return n;
  }

  private sameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private toDateInput(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toTimeInput(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  formatHora(d: Date): string {
    return this.toTimeInput(d);
  }

  trackEvent(_: number, e: CalEvent): string {
    return e.id;
  }

  trackCell(_: number, c: DayCell): number {
    return c.date.getTime();
  }
}
