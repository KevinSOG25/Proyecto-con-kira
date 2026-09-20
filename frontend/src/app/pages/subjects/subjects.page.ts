import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { SubjectsService } from '../../services/subjects.service';
import { GradesService } from '../../services/grades.service';
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
      error: () => this.error.set('No se pudo crear la materia.'),
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
    const dto: CreateGrade = { materiaId: materia.id, ...this.newGrade };
    this.gradesService.create(dto).subscribe({
      next: (g) => {
        this.grades.update((list) => [...list, g]);
        this.newGrade = { nombreCorte: '', porcentaje: 0, calificacionObtenida: null };
      },
      error: () => this.error.set('No se pudo agregar el corte.'),
    });
  }

  deleteGrade(g: Grade): void {
    this.gradesService.remove(g.id).subscribe({
      next: () => this.grades.update((list) => list.filter((x) => x.id !== g.id)),
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
          err?.error?.message ??
            'No se pudo simular (revisa que los porcentajes sumen 100%).',
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
