import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeeklyPlansService } from '../../services/weekly-plans.service';
import { SubjectsService } from '../../services/subjects.service';
import { Subject, WeeklyPlan } from '../../models/api.models';

const TOTAL_WEEKS = 16;

interface WeekState {
  weekNumber: number;
  id: string | null;
  content: string;
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

  ngOnInit(): void {
    this.subjectsService.findAll().subscribe({
      next: (data) => this.subjects.set(data),
    });
    this.loadPlans();
  }

  private buildEmptyWeeks(): WeekState[] {
    return Array.from({ length: TOTAL_WEEKS }, (_, i) => ({
      weekNumber: i + 1,
      id: null,
      content: '',
      saving: false,
      saved: false,
    }));
  }

  onSubjectChange(id: string): void {
    this.selectedSubjectId.set(id);
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading.set(true);
    this.error.set(null);
    // '' -> generales (materiaId=null en backend); uuid -> por materia.
    const filter = this.selectedSubjectId() === '' ? 'null' : this.selectedSubjectId();
    const fresh = this.buildEmptyWeeks();
    this.plansService.findAll(filter).subscribe({
      next: (plans: WeeklyPlan[]) => {
        for (const p of plans) {
          const week = fresh.find((w) => w.weekNumber === p.weekNumber);
          if (week) {
            week.id = p.id;
            week.content = p.content;
          }
        }
        this.weeks.set(fresh);
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

  saveWeek(week: WeekState): void {
    week.saving = true;
    week.saved = false;
    this.error.set(null);
    const materiaId =
      this.selectedSubjectId() === '' ? undefined : this.selectedSubjectId();

    this.plansService
      .upsert({ weekNumber: week.weekNumber, content: week.content, materiaId })
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

  trackWeek(_: number, w: WeekState): number {
    return w.weekNumber;
  }
}
