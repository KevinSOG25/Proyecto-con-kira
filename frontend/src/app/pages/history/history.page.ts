import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { finalize } from 'rxjs';
import { CurriculumService } from '../../services/curriculum.service';
import { ThemeService } from '../../services/theme.service';
import {
  SemesterHistoryEntry,
  SemesterHistoryResponse,
} from '../../models/api.models';

@Component({
  selector: 'app-history-page',
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './history.page.html',
  styleUrl: './history.page.scss',
})
export class HistoryPage implements OnInit {
  private curriculumService = inject(CurriculumService);
  private theme = inject(ThemeService);
  private router = inject(Router);

  data = signal<SemesterHistoryResponse | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  mensaje = signal<string | null>(null);

  /** Periodo cuyo acordeón está expandido. */
  expanded = signal<string | null>(null);

  lineChartData = signal<ChartData<'line'>>({ labels: [], datasets: [] });
  lineChartOptions = signal<ChartOptions<'line'>>(this.buildOptions(false));

  constructor() {
    effect(() => {
      const dark = this.theme.isDark();
      this.lineChartOptions.set(this.buildOptions(dark));
    });
  }

  ngOnInit(): void {
    this.load();
  }

  readonly hayHistorial = computed(() => (this.data()?.semestres.length ?? 0) > 0);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.curriculumService
      .history()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.data.set(res);
          this.buildChart(res);
          // Expande el más reciente por defecto.
          if (res.semestres.length) {
            this.expanded.set(res.semestres[0].periodo);
          }
        },
        error: () =>
          this.error.set(
            'No se pudo cargar el historial. Verifica la conexión con el backend.',
          ),
      });
  }

  toggle(periodo: string): void {
    this.expanded.update((cur) => (cur === periodo ? null : periodo));
  }

  isOpen(periodo: string): boolean {
    return this.expanded() === periodo;
  }

  /** Reabre (deshace el cierre de) un semestre archivado. */
  reabrir(entry: SemesterHistoryEntry): void {
    if (
      !confirm(
        `¿Reabrir el semestre ${entry.periodo}? Sus materias volverán a estar activas y el cierre se deshará. Solo es posible si no hay un semestre activo en curso.`,
      )
    ) {
      return;
    }
    this.mensaje.set(null);
    this.error.set(null);
    this.curriculumService.reopenSemester(entry.periodo).subscribe({
      next: (res) => {
        this.mensaje.set(res.mensaje);
        this.load();
      },
      error: (err) =>
        this.error.set(
          err?.error?.message ??
            'No se pudo reabrir el semestre. ¿Hay un periodo activo en curso?',
        ),
    });
  }

  notaClase(nota: number): string {
    if (nota >= 4) return 'nota--safe';
    if (nota >= 3) return 'nota--mid';
    return 'nota--danger';
  }

  irADashboard(): void {
    this.router.navigate(['/']);
  }

  // ---- Gráfica comparativa (semestral vs. acumulada/PGA) ----
  private buildChart(res: SemesterHistoryResponse): void {
    // Orden cronológico ascendente para la línea de tiempo.
    const cronologico = [...res.semestres].sort((a, b) =>
      a.periodo.localeCompare(b.periodo),
    );
    this.lineChartData.set({
      labels: cronologico.map((s) => s.periodo),
      datasets: [
        {
          label: 'Promedio semestral',
          data: cronologico.map((s) => Number(s.promedioFinal.toFixed(2))),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
        },
        {
          label: 'PGA acumulado',
          data: cronologico.map((s) => Number(s.pgaAcumulado.toFixed(2))),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
          fill: false,
          borderDash: [6, 4],
          pointRadius: 4,
        },
      ],
    });
  }

  private buildOptions(dark: boolean): ChartOptions<'line'> {
    const tick = dark ? '#a1a1aa' : '#64748b';
    const grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
    const tipBg = dark ? '#27272a' : '#0f172a';
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 5,
          ticks: { stepSize: 1, color: tick },
          grid: { color: grid },
        },
        x: { ticks: { color: tick }, grid: { display: false } },
      },
      plugins: {
        legend: {
          display: true,
          labels: { color: tick, usePointStyle: true },
        },
        tooltip: {
          backgroundColor: tipBg,
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(2)} / 5.0`,
          },
        },
      },
    };
  }

  hasChartData(): boolean {
    return (this.data()?.semestres.length ?? 0) >= 1;
  }
}
