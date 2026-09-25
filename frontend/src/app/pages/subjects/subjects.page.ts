import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { SubjectsService } from '../../services/subjects.service';
import { GradesService } from '../../services/grades.service';
import { extractHttpErrorMessage } from '../../utils/http-error';
import {
  CreateGrade,
  CreateSubject,
  Grade,
  SimulationResult,
  Subject,
} from '../../models/api.models';

@Component({
  selector: 'app-subjects-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './subjects.page.html',
  styleUrl: './subjects.page.scss',
})
export class SubjectsPage implements OnInit {
  private subjectsService = inject(SubjectsService);
  private gradesService = inject(GradesService);

  subjects = signal<Subject[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Formulario de nueva materia.
  newSubject: CreateSubject = { nombre: '', codigo: '', creditos: 3, semestre: '' };

  // Materia seleccionada + sus cortes + simulación.
  selected = signal<Subject | null>(null);
  grades = signal<Grade[]>([]);
  simulation = signal<SimulationResult | null>(null);
  objetivo = 3.0;

  // Formulario de nuevo corte.
  newGrade: Omit<CreateGrade, 'materiaId'> = {
    nombreCorte: '',
    porcentaje: 0,
    calificacionObtenida: null,
  };

  // --- Temas por corte (expandir/colapsar) ---
  expandedTopicsId = signal<string | null>(null);

  toggleTopics(g: Grade): void {
    this.expandedTopicsId.update((cur) => (cur === g.id ? null : g.id));
  }

  isTopicsOpen(g: Grade): boolean {
    return this.expandedTopicsId() === g.id;
  }

  // --- Edición inline de cortes ---
  editingGradeId = signal<string | null>(null);
  editModel: { nombreCorte: string; porcentaje: number; calificacionObtenida: number | null } = {
    nombreCorte: '',
    porcentaje: 0,
    calificacionObtenida: null,
  };
  savingEdit = signal(false);

  ngOnInit(): void {
    this.loadSubjects();
  }

  loadSubjects(): void {
    this.loading.set(true);
    this.error.set(null);
    this.subjectsService
      .findAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.subjects.set(data),
        error: () => this.error.set('No se pudieron cargar las materias.'),
      });
  }

  createSubject(): void {
    if (!this.newSubject.nombre.trim()) return;
    this.subjectsService.create(this.newSubject).subscribe({
      next: (s) => {
        this.subjects.update((list) => [s, ...list]);
        this.newSubject = { nombre: '', codigo: '', creditos: 3, semestre: '' };
      },
      error: (err) =>
        this.error.set(extractHttpErrorMessage(err, 'No se pudo crear la materia.')),
    });
  }

  deleteSubject(s: Subject, event: Event): void {
    event.stopPropagation();
    this.subjectsService.remove(s.id).subscribe({
      next: () => {
        this.subjects.update((list) => list.filter((x) => x.id !== s.id));
        if (this.selected()?.id === s.id) this.clearSelection();
      },
    });
  }

  select(s: Subject): void {
    this.selected.set(s);
    this.simulation.set(null);
    this.loadGrades(s.id);
  }

  clearSelection(): void {
    this.selected.set(null);
    this.grades.set([]);
    this.simulation.set(null);
  }

  loadGrades(materiaId: string): void {
    this.gradesService.findBySubject(materiaId).subscribe({
      next: (g) => this.grades.set(g),
    });
  }

  addGrade(): void {
    const materia = this.selected();
    if (!materia || !this.newGrade.nombreCorte.trim()) return;

    // Guarda defensiva: sin id de materia, la petición fallaría con
    // "materiaId must be a UUID". Avisamos con un mensaje claro.
    if (!materia.id) {
      this.error.set(
        'La materia seleccionada no tiene un identificador válido. Recarga la página e inténtalo de nuevo.',
      );
      return;
    }

    // Normaliza los valores del formulario (los inputs numéricos pueden
    // llegar como string o vacío) para no romper la validación del backend.
    const dto: CreateGrade = {
      materiaId: materia.id,
      nombreCorte: this.newGrade.nombreCorte.trim(),
      porcentaje: Number(this.newGrade.porcentaje) || 0,
      calificacionObtenida:
        this.newGrade.calificacionObtenida === null ||
        (this.newGrade.calificacionObtenida as unknown as string) === ''
          ? null
          : Number(this.newGrade.calificacionObtenida),
    };

    this.gradesService.create(dto).subscribe({
      next: (g) => {
        this.grades.update((list) => [...list, g]);
        this.newGrade = { nombreCorte: '', porcentaje: 0, calificacionObtenida: null };
        this.error.set(null);
      },
      // Muestra el mensaje REAL de NestJS (class-validator o BD).
      error: (err) =>
        this.error.set(extractHttpErrorMessage(err, 'No se pudo agregar el corte.')),
    });
  }

  deleteGrade(g: Grade): void {
    this.gradesService.remove(g.id).subscribe({
      next: () => this.grades.update((list) => list.filter((x) => x.id !== g.id)),
      error: (err) =>
        this.error.set(extractHttpErrorMessage(err, 'No se pudo eliminar el corte.')),
    });
  }

  /** Inicia la edición inline de un corte, precargando sus valores. */
  startEdit(g: Grade): void {
    this.editingGradeId.set(g.id);
    this.editModel = {
      nombreCorte: g.nombreCorte,
      porcentaje: Number(g.porcentaje),
      calificacionObtenida:
        g.calificacionObtenida === null ? null : Number(g.calificacionObtenida),
    };
  }

  cancelEdit(): void {
    this.editingGradeId.set(null);
  }

  isEditing(g: Grade): boolean {
    return this.editingGradeId() === g.id;
  }

  /** Guarda los cambios del corte vía PATCH /grades/:id (sin borrar/recrear). */
  saveEdit(g: Grade): void {
    if (!this.editModel.nombreCorte.trim()) {
      this.error.set('El nombre del corte no puede estar vacío.');
      return;
    }
    this.savingEdit.set(true);
    this.error.set(null);
    const payload = {
      nombreCorte: this.editModel.nombreCorte,
      porcentaje: Number(this.editModel.porcentaje),
      calificacionObtenida:
        this.editModel.calificacionObtenida === null ||
        (this.editModel.calificacionObtenida as unknown as string) === ''
          ? null
          : Number(this.editModel.calificacionObtenida),
    };
    this.gradesService.update(g.id, payload).subscribe({
      next: (updated) => {
        this.grades.update((list) =>
          list.map((x) => (x.id === g.id ? updated : x)),
        );
        this.editingGradeId.set(null);
        this.savingEdit.set(false);
        // Si había una simulación, la recalculamos con los nuevos valores.
        if (this.simulation()) this.runSimulation();
      },
      error: (err) => {
        this.savingEdit.set(false);
        this.error.set(
          extractHttpErrorMessage(err, 'No se pudo actualizar el corte.'),
        );
      },
    });
  }

  /** Ejecuta el simulador "¿Cuánto necesito para pasar?". */
  runSimulation(): void {
    const materia = this.selected();
    if (!materia) return;
    this.error.set(null);
    this.gradesService.simulate(materia.id, this.objetivo).subscribe({
      next: (res) => this.simulation.set(res),
      error: (err) =>
        this.error.set(
          extractHttpErrorMessage(
            err,
            'No se pudo simular (revisa que los porcentajes sumen 100%).',
          ),
        ),
    });
  }

  /** Suma de porcentajes de los cortes actuales. */
  totalPorcentaje(): number {
    return this.grades().reduce((acc, g) => acc + Number(g.porcentaje), 0);
  }

  /** Clase de color Bootstrap según el estado de la simulación. */
  estadoClass(estado: SimulationResult['estado']): string {
    switch (estado) {
      case 'ALCANZABLE':
        return 'alert-info';
      case 'OBJETIVO_YA_ASEGURADO':
        return 'alert-success';
      case 'IMPOSIBLE':
        return 'alert-danger';
      default:
        return 'alert-secondary';
    }
  }
}
