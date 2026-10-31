import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { finalize } from 'rxjs';
import { AnalyticsService } from '../../services/analytics.service';
import { SubjectSelectionService } from '../../services/subject-selection.service';
import { ThemeService } from '../../services/theme.service';
import {
  DashboardAnalytics,
  EffortMatrixItem,
  PriorityLevel,
  SubjectGrade,
} from '../../models/api.models';

const NOTA_MAXIMA = 5;

type AvgView = 'relativa' | 'neta';

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnInit {
  private analyticsService = inject(AnalyticsService);
  private subjectSelection = inject(SubjectSelectionService);
  private router = inject(Router);
  private theme = inject(ThemeService);

  data = signal<DashboardAnalytics | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  /** Vista del promedio/gráfico: actual relativa (default) o acumulada neta. */
  avgView = signal<AvgView>('relativa');

  /** Temas desplegados en "Próximas evaluaciones". */
  expandedEvalId = signal<string | null>(null);

  /** Valor principal del anillo según la vista seleccionada. */
  promedio = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return this.avgView() === 'relativa'
      ? d.promedioPonderadoActual
      : d.promedioAcumuladoNeto;
  });

  /** Puntos netos asegurados (subtítulo). */
  promedioNeto = computed(() => this.data()?.promedioAcumuladoNeto ?? 0);

  readonly circleCircumference = 2 * Math.PI * 52;

  strokeOffset = computed(() => {
    const ratio = Math.min(this.promedio() / NOTA_MAXIMA, 1);
    return this.circleCircumference * (1 - ratio);
  });

  ringColor = computed(() => this.colorForNota(this.promedio()));

  // --- Gráfico de barras ---
  barChartData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });

  /** Opciones del gráfico, reactivas al tema (colores de ejes/grid/tooltip). */
  barChartOptions = signal<ChartOptions<'bar'>>(this.buildChartOptions(false));

  constructor() {
    // Reconstruye las opciones del gráfico al cambiar el tema (claro/oscuro).
    effect(() => {
      const dark = this.theme.isDark();
      this.barChartOptions.set(this.buildChartOptions(dark));
    });
  }

  /** Construye opciones de Chart.js adaptadas al tema actual. */
  private buildChartOptions(dark: boolean): ChartOptions<'bar'> {
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
        x: {
          ticks: { color: tick },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tipBg,
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            label: (ctx) => {
              const y = ctx.parsed.y ?? 0;
              const etiqueta =
                this.avgView() === 'relativa' ? 'Nota actual' : 'Acumulado neto';
              return `${etiqueta}: ${y.toFixed(2)} / 5.0`;
            },
          },
        },
      },
    };
  }

  ngOnInit(): void {
    this.load();
  }

  /** Color según la nota (verde ≥4, violeta ≥3, rojo <3). */
  private colorForNota(n: number): string {
    if (n >= 4) return '#10b981'; // esmeralda
    if (n >= 3) return '#8b5cf6'; // violeta
    return '#ef4444'; // rojo/ámbar
  }

  /** Normaliza códigos: ISIS2311 -> ISIS-2311. */
  normalizeCode(code: string | null, fallback: string): string {
    if (!code) return fallback;
    const m = code.match(/^([A-Za-z]+)[-\s]?(\d.*)$/);
    return m ? `${m[1].toUpperCase()}-${m[2]}` : code;
  }

  setAvgView(view: AvgView): void {
    this.avgView.set(view);
    const d = this.data();
    if (d) this.buildChart(d);
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

  /** Nota mostrada por materia según la vista. */
  private notaDeVista(m: SubjectGrade): number {
    if (this.avgView() === 'relativa') {
      return m.notaActualRelativa ?? 0;
    }
    return m.notaAcumulada;
  }

  private buildChart(res: DashboardAnalytics): void {
    const evaluadas = res.materias.filter((m) => m.porcentajeEvaluado > 0);
    const colors = evaluadas.map((m) => this.colorForNota(this.notaDeVista(m)));

    this.barChartData.set({
      labels: evaluadas.map((m) => this.normalizeCode(m.codigo, m.nombre)),
      datasets: [
        {
          data: evaluadas.map((m) => Number(this.notaDeVista(m).toFixed(2))),
          label: this.avgView() === 'relativa' ? 'Nota actual' : 'Acumulado neto',
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

  // ---- Semáforo de riesgo ----
  riskCardClass(level: 'SAFE' | 'WARNING' | 'DANGER'): string {
    return `risk-${level.toLowerCase()}`;
  }

  riskIcon(level: 'SAFE' | 'WARNING' | 'DANGER'): string {
    switch (level) {
      case 'DANGER':
        return '🛑';
      case 'WARNING':
        return '⚠️';
      default:
        return '✅';
    }
  }

  riskLabel(level: 'SAFE' | 'WARNING' | 'DANGER'): string {
    switch (level) {
      case 'DANGER':
        return 'En riesgo de perder';
      case 'WARNING':
        return 'Riesgo medio';
      default:
        return 'Vas bien';
    }
  }

  /** Clase de color para el badge de nota actual de la tarjeta. */
  notaBadgeClass(n: number | null): string {
    if (n === null) return 'nota-badge--none';
    if (n >= 4) return 'nota-badge--safe';
    if (n >= 3) return 'nota-badge--mid';
    return 'nota-badge--danger';
  }

  /** Navega a /materias seleccionando la materia de la tarjeta. */
  openSubject(m: SubjectGrade): void {
    this.subjectSelection.select(m.materiaId);
    this.router.navigate(['/materias']);
  }

  // ---- Próximas evaluaciones ----
  toggleEvalTopics(gradeId: string): void {
    this.expandedEvalId.update((cur) => (cur === gradeId ? null : gradeId));
  }

  isEvalOpen(gradeId: string): boolean {
    return this.expandedEvalId() === gradeId;
  }

  diasLabel(dias: number | null): string {
    if (dias === null) return 'Sin fecha';
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Mañana';
    return `En ${dias} días`;
  }

  // ---- Matriz de Retorno de Esfuerzo ----

  /** Nota esperada del micro-simulador por corte (por defecto 4.0). */
  private simNotas = signal<Record<string, number>>({});

  simNota(corteId: string): number {
    return this.simNotas()[corteId] ?? 4.0;
  }

  setSimNota(corteId: string, value: number | string): void {
    const n = Math.max(0, Math.min(5, Number(value) || 0));
    this.simNotas.update((cur) => ({ ...cur, [corteId]: n }));
  }

  /** Clase de color del badge de prioridad. */
  prioridadClass(nivel: PriorityLevel): string {
    return `prio-${nivel.toLowerCase()}`;
  }

  prioridadLabel(nivel: PriorityLevel): string {
    switch (nivel) {
      case 'CRITICA':
        return 'Crítica';
      case 'ALTA':
        return 'Alta';
      case 'MEDIA':
        return 'Media';
      default:
        return 'Baja';
    }
  }

  /** Impacto proyectado del micro-simulador: nota elegida × sensibilidad×10. */
  impactoSimulado(item: EffortMatrixItem): number {
    // impacto = sensibilidadDecima * (nota / 0.1) = sensibilidadDecima * nota * 10
    return item.sensibilidadDecima * this.simNota(item.corteId) * 10;
  }

  /** Promedio semestral proyectado si saca la nota elegida en este corte. */
  promedioProyectado(item: EffortMatrixItem): number {
    const base = this.promedioNeto();
    return Number((base + this.impactoSimulado(item)).toFixed(2));
  }

  // ============================================================
  //  Bloque 1 — Simulador Global de Meta Semestral
  // ============================================================
  /** Meta de promedio semestral elegida por el usuario (3.0–5.0). */
  metaPromedio = signal(4.0);
  /** Resultado del último cálculo inverso. */
  metaFactible = signal<boolean>(true);
  metaMensaje = signal<string | null>(null);

  readonly metasRapidas = [
    { label: 'Pasar raspando', valor: 3.2 },
    { label: 'Meta alta', valor: 4.0 },
    { label: 'Excelencia', valor: 4.5 },
  ];

  setMeta(valor: number | string): void {
    const v = Math.max(3, Math.min(5, Number(valor) || 0));
    this.metaPromedio.set(Number(v.toFixed(2)));
  }

  /** Fija la meta al promedio actual (vista relativa). */
  metaMantenerActual(): void {
    this.setMeta(this.promedio() || 4.0);
    this.calcularNotasNecesarias();
  }

  /**
   * Sensibilidad total: cuánto sube el promedio semestral por cada 0.1
   * adicional repartido uniformemente en TODAS las evaluaciones pendientes.
   * Σ sensibilidadDecima_i.
   */
  private sensibilidadTotal(): number {
    return (this.data()?.effortMatrix ?? []).reduce(
      (acc, it) => acc + it.sensibilidadDecima,
      0,
    );
  }

  /** Promedio máximo posible si saca 5.0 en todo lo pendiente. */
  promedioMaximoPosible(): number {
    const base = this.promedioNeto();
    // 5.0 en todos los cortes => suma de impactoMaximoPromedio.
    const maxExtra = (this.data()?.effortMatrix ?? []).reduce(
      (acc, it) => acc + it.impactoMaximoPromedio,
      0,
    );
    return Number((base + maxExtra).toFixed(2));
  }

  /**
   * Cálculo inverso: dada la meta, halla la nota uniforme mínima necesaria
   * en las evaluaciones pendientes y ajusta todos los sliders de la Matriz.
   */
  calcularNotasNecesarias(): void {
    const matrix = this.data()?.effortMatrix ?? [];
    this.metaMensaje.set(null);

    if (matrix.length === 0) {
      this.metaFactible.set(true);
      this.metaMensaje.set('No hay evaluaciones pendientes por simular.');
      return;
    }

    const base = this.promedioNeto();
    const meta = this.metaPromedio();
    const sensTotal = this.sensibilidadTotal(); // sube por cada 0.1 uniforme

    // promedioFinal = base + sensTotal * (nota * 10)  [nota uniforme]
    //   => nota = (meta - base) / (sensTotal * 10)
    const denom = sensTotal * 10;
    if (denom <= 0) {
      this.metaFactible.set(true);
      return;
    }
    const notaNecesariaRaw = (meta - base) / denom;
    const notaNecesaria = Number(notaNecesariaRaw.toFixed(2));

    if (notaNecesariaRaw > 5.0 + 1e-9) {
      // Inalcanzable: fijar todo en 5.0 y avisar el máximo posible.
      this.aplicarNotaUniforme(5.0);
      this.metaFactible.set(false);
      this.metaMensaje.set(
        `Meta inalcanzable: ni con 5.0 en todo lo pendiente. ` +
          `El máximo posible es ${this.promedioMaximoPosible().toFixed(2)}.`,
      );
      return;
    }

    const notaAjustada = Math.max(0, Math.min(5, notaNecesaria));
    this.aplicarNotaUniforme(notaAjustada);
    this.metaFactible.set(true);
    if (notaNecesariaRaw <= 0) {
      this.metaMensaje.set(
        `¡Meta ya asegurada! Con tus notas actuales superas ${meta.toFixed(2)}.`,
      );
    } else {
      this.metaMensaje.set(
        `Necesitas un promedio de ${notaAjustada.toFixed(2)} en las evaluaciones pendientes para alcanzar ${meta.toFixed(2)}.`,
      );
    }
  }

  /** Ajusta todos los sliders de la matriz a una nota uniforme. */
  private aplicarNotaUniforme(nota: number): void {
    const next: Record<string, number> = {};
    for (const it of this.data()?.effortMatrix ?? []) {
      next[it.corteId] = nota;
    }
    this.simNotas.set(next);
  }

  /** Restablece todos los sliders al valor por defecto (4.0). */
  restablecerSimulacion(): void {
    this.simNotas.set({});
    this.metaPromedio.set(4.0);
    this.metaFactible.set(true);
    this.metaMensaje.set(null);
  }

  /** Promedio semestral proyectado con TODAS las notas de los sliders. */
  promedioSemestralSimulado(): number {
    const base = this.promedioNeto();
    const extra = (this.data()?.effortMatrix ?? []).reduce(
      (acc, it) => acc + it.sensibilidadDecima * this.simNota(it.corteId) * 10,
      0,
    );
    return Number((base + extra).toFixed(2));
  }

  // ---- Resumen "Nota mínima para pasar (3.0)" por materia ----

  /** Estado de la nota mínima para cerrar la materia en 3.0. */
  notaMinimaEstado(m: SubjectGrade): {
    clase: string;
    texto: string;
  } {
    // Ya aprobada neta (aporte >= 3.0 asegurado).
    if (m.notaAcumulada >= 3.0) {
      return { clase: 'nm-safe', texto: '¡Ya pasaste! (+3.0 asegurado)' };
    }
    if (m.porcentajeRestante <= 0) {
      return { clase: 'nm-danger', texto: `Cerró en ${m.notaAcumulada.toFixed(2)} (< 3.0)` };
    }
    const req = m.notaNecesaria;
    if (req === null) {
      return { clase: 'nm-mid', texto: 'Sin datos suficientes' };
    }
    if (req > 5.0) {
      return { clase: 'nm-danger', texto: 'En riesgo crítico (imposible)' };
    }
    if (req > 4.2) {
      return {
        clase: 'nm-danger',
        texto: `En riesgo: necesitas ${req.toFixed(2)} en el ${m.porcentajeRestante}% restante`,
      };
    }
    return {
      clase: 'nm-mid',
      texto: `Necesitas ${req.toFixed(2)} en el ${m.porcentajeRestante}% restante`,
    };
  }
}
