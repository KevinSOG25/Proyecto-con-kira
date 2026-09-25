import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartOptions } from 'chart.js';
import { finalize } from 'rxjs';
import { AnalyticsService } from '../../services/analytics.service';
import { DashboardAnalytics } from '../../models/api.models';

const NOTA_MAXIMA = 5;

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, RouterLink, BaseChartDirective],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnInit {
  private analyticsService = inject(AnalyticsService);

  data = signal<DashboardAnalytics | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  /** Promedio para el spinner (0-5). */
  promedio = computed(() => this.data()?.promedioPonderadoSemestral ?? 0);

  /** Perímetro del círculo del spinner (radio 52). */
  readonly circleCircumference = 2 * Math.PI * 52;

  /** Longitud del arco proporcional al promedio (sobre 5.0). */
  strokeOffset = computed(() => {
    const ratio = Math.min(this.promedio() / NOTA_MAXIMA, 1);
    return this.circleCircumference * (1 - ratio);
  });

  /** Color del anillo según el promedio. */
  ringColor = computed(() => {
    const p = this.promedio();
    if (p >= 4) return '#10b981'; // verde
    if (p >= 3) return '#6366f1'; // índigo (aprobado)
    return '#ef4444'; // rojo (por debajo de 3.0)
  });

  // --- Configuración del gráfico de barras ---
  barChartData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });

  barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 5,
        ticks: { stepSize: 1 },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      x: {
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const y = ctx.parsed.y ?? 0;
            return `Nota final: ${y.toFixed(2)} / 5.0`;
          },
        },
      },
    },
  };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.analyticsService
      .getDashboard()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.data.set(res);
          this.buildChart(res);
        },
        error: () =>
          this.error.set(
            'No se pudo cargar el dashboard. Verifica la conexión con el backend.',
          ),
      });
  }

  private buildChart(res: DashboardAnalytics): void {
    // Solo materias con algo evaluado tienen sentido en la gráfica.
    const evaluadas = res.materias.filter((m) => m.porcentajeEvaluado > 0);
    const colors = evaluadas.map((m) => {
      if (m.notaFinal >= 4) return '#10b981';
      if (m.notaFinal >= 3) return '#6366f1';
      return '#ef4444';
    });

    this.barChartData.set({
      labels: evaluadas.map((m) => m.codigo || m.nombre),
      datasets: [
        {
          data: evaluadas.map((m) => m.notaFinal),
          label: 'Nota final',
          backgroundColor: colors,
          borderRadius: 8,
          maxBarThickness: 60,
        },
      ],
    });
  }

  hasChartData(): boolean {
    return (this.barChartData().labels?.length ?? 0) > 0;
  }
}
