import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  ScheduleAiService,
  ParsedClass,
  ProjectedSubject,
} from '../../services/schedule-ai.service';
import { extractHttpErrorMessage } from '../../utils/http-error';

/** Un bloque horario de una sección. */
interface Bloque {
  dia: number; // 0=Lun ... 4=Vie (5=Sáb opcional)
  inicio: number; // minutos desde 00:00
  fin: number;
  salon?: string;
}

interface Seccion {
  id: string;
  materia: string;
  seccion: string;
  bloques: Bloque[];
}

interface Combinacion {
  secciones: Seccion[];
  huecos: number; // minutos totales de hueco entre clases
  diasUsados: number[];
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
/** Mapa de nombres de día (IA) a índice de columna. */
const DIA_INDEX: Record<string, number> = {
  lunes: 0, lun: 0,
  martes: 1, mar: 1,
  miercoles: 2, 'miércoles': 2, mie: 2, 'mié': 2,
  jueves: 3, jue: 3,
  viernes: 4, vie: 4,
  sabado: 5, 'sábado': 5, sab: 5, 'sáb': 5,
};

@Component({
  selector: 'app-schedule-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule.page.html',
  styleUrl: './schedule.page.scss',
})
export class SchedulePage implements OnInit {
  private scheduleAi = inject(ScheduleAiService);

  readonly dias = DIAS;
  /** Horas de la cuadrícula (7:00 a 21:00). */
  readonly horas = Array.from({ length: 15 }, (_, i) => 7 + i);

  secciones = signal<Seccion[]>([]);

  /** Materias proyectadas desde el Pensum pendientes de ubicar. */
  proyectadas = signal<ProjectedSubject[]>([]);

  // --- Importación con IA ---
  aiModalOpen = signal(false);
  aiLoading = signal(false);
  aiTexto = '';
  aiImagenes = signal<string[]>([]);
  aiError = signal<string | null>(null);
  aiProvider = signal<string | null>(null);

  ngOnInit(): void {
    // Recoge materias proyectadas que vengan del Pensum.
    const proy = this.scheduleAi.consumeProyectadas();
    if (proy.length) this.proyectadas.set(proy);
  }

  // Formulario de nueva sección.
  nuevaMateria = '';
  nuevaSeccion = '';
  bloqueDia = 0;
  bloqueInicio = '08:00';
  bloqueFin = '10:00';
  bloquesTmp = signal<Bloque[]>([]);

  // Preferencias.
  prefMinimizarHuecos = signal(true);
  prefJornada = signal<'cualquiera' | 'manana' | 'tarde'>('cualquiera');
  prefDiaLibre = signal<number | null>(null);

  combinaciones = signal<Combinacion[]>([]);
  seleccionada = signal<Combinacion | null>(null);
  error = signal<string | null>(null);

  // ---- Construcción de secciones ----
  private toMin(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  fmt(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  addBloqueTmp(): void {
    const inicio = this.toMin(this.bloqueInicio);
    const fin = this.toMin(this.bloqueFin);
    if (fin <= inicio) {
      this.error.set('La hora de fin debe ser mayor a la de inicio.');
      return;
    }
    this.error.set(null);
    this.bloquesTmp.update((b) => [
      ...b,
      { dia: Number(this.bloqueDia), inicio, fin },
    ]);
  }

  removeBloqueTmp(i: number): void {
    this.bloquesTmp.update((b) => b.filter((_, idx) => idx !== i));
  }

  addSeccion(): void {
    if (!this.nuevaMateria.trim() || !this.nuevaSeccion.trim()) {
      this.error.set('Indica materia y número/nombre de sección.');
      return;
    }
    if (this.bloquesTmp().length === 0) {
      this.error.set('Agrega al menos un bloque horario a la sección.');
      return;
    }
    this.secciones.update((s) => [
      ...s,
      {
        id: crypto.randomUUID(),
        materia: this.nuevaMateria.trim(),
        seccion: this.nuevaSeccion.trim(),
        bloques: this.bloquesTmp(),
      },
    ]);
    this.nuevaSeccion = '';
    this.bloquesTmp.set([]);
    this.error.set(null);
  }

  removeSeccion(id: string): void {
    this.secciones.update((s) => s.filter((x) => x.id !== id));
  }

  /** Materias distintas ingresadas. */
  materias = computed(() => [...new Set(this.secciones().map((s) => s.materia))]);

  seccionesDe(materia: string): Seccion[] {
    return this.secciones().filter((s) => s.materia === materia);
  }

  fmtBloques(s: Seccion): string {
    return s.bloques
      .map((b) => `${DIAS[b.dia]} ${this.fmt(b.inicio)}-${this.fmt(b.fin)}`)
      .join(', ');
  }

  // ---- Generación / optimización ----
  private solapan(a: Bloque, b: Bloque): boolean {
    return a.dia === b.dia && a.inicio < b.fin && b.inicio < a.fin;
  }

  private hayChoque(secs: Seccion[]): boolean {
    const bloques = secs.flatMap((s) => s.bloques);
    for (let i = 0; i < bloques.length; i++) {
      for (let j = i + 1; j < bloques.length; j++) {
        if (this.solapan(bloques[i], bloques[j])) return true;
      }
    }
    return false;
  }

  /** Minutos de hueco entre clases consecutivas por día. */
  private calcularHuecos(secs: Seccion[]): number {
    const porDia = new Map<number, Bloque[]>();
    for (const b of secs.flatMap((s) => s.bloques)) {
      if (!porDia.has(b.dia)) porDia.set(b.dia, []);
      porDia.get(b.dia)!.push(b);
    }
    let total = 0;
    for (const bloques of porDia.values()) {
      bloques.sort((a, b) => a.inicio - b.inicio);
      for (let i = 1; i < bloques.length; i++) {
        total += Math.max(0, bloques[i].inicio - bloques[i - 1].fin);
      }
    }
    return total;
  }

  private diasUsados(secs: Seccion[]): number[] {
    return [...new Set(secs.flatMap((s) => s.bloques.map((b) => b.dia)))].sort();
  }

  private cumplePreferencias(secs: Seccion[]): boolean {
    const bloques = secs.flatMap((s) => s.bloques);

    // Día libre específico.
    const diaLibre = this.prefDiaLibre();
    if (diaLibre !== null && bloques.some((b) => b.dia === diaLibre)) {
      return false;
    }

    // Jornada.
    const jornada = this.prefJornada();
    if (jornada === 'manana' && bloques.some((b) => b.fin > 13 * 60)) return false;
    if (jornada === 'tarde' && bloques.some((b) => b.inicio < 13 * 60)) return false;

    return true;
  }

  generar(): void {
    this.error.set(null);
    const materias = this.materias();
    if (materias.length === 0) {
      this.error.set('Agrega al menos una materia con sus secciones.');
      return;
    }

    // Producto cartesiano de una sección por materia.
    const grupos = materias.map((m) => this.seccionesDe(m));
    let combos: Seccion[][] = [[]];
    for (const grupo of grupos) {
      const next: Seccion[][] = [];
      for (const combo of combos) {
        for (const sec of grupo) {
          next.push([...combo, sec]);
        }
      }
      combos = next;
      // Límite de seguridad para no explotar combinatoriamente.
      if (combos.length > 20000) break;
    }

    const validas: Combinacion[] = combos
      .filter((c) => !this.hayChoque(c) && this.cumplePreferencias(c))
      .map((c) => ({
        secciones: c,
        huecos: this.calcularHuecos(c),
        diasUsados: this.diasUsados(c),
      }));

    // Ordenar: minimizar huecos (si está activo) y luego menos días usados.
    validas.sort((a, b) => {
      if (this.prefMinimizarHuecos() && a.huecos !== b.huecos) {
        return a.huecos - b.huecos;
      }
      return a.diasUsados.length - b.diasUsados.length;
    });

    this.combinaciones.set(validas.slice(0, 20));
    this.seleccionada.set(validas[0] ?? null);
    if (validas.length === 0) {
      this.error.set(
        'No hay combinaciones válidas con esas secciones y preferencias. Ajusta los filtros.',
      );
    }
  }

  seleccionar(c: Combinacion): void {
    this.seleccionada.set(c);
  }

  // ---- Render de la cuadrícula ----
  /** Bloques de la combinación seleccionada que caen en (día, hora). */
  bloqueEn(dia: number, hora: number): { materia: string; seccion: string } | null {
    const sel = this.seleccionada();
    if (!sel) return null;
    const inicioHora = hora * 60;
    for (const s of sel.secciones) {
      for (const b of s.bloques) {
        if (b.dia === dia && b.inicio < inicioHora + 60 && inicioHora < b.fin) {
          return { materia: s.materia, seccion: s.seccion };
        }
      }
    }
    return null;
  }

  colorMateria(materia: string): string {
    const palette = ['#8b5cf6', '#10b981', '#38bdf8', '#f59e0b', '#ef4444', '#6366f1'];
    const idx = this.materias().indexOf(materia);
    return palette[idx % palette.length];
  }

  removeProyectada(codigo: string): void {
    this.proyectadas.update((p) => p.filter((x) => x.codigo !== codigo));
  }

  // ============================================================
  //  Importación de horario con IA (texto / imágenes)
  // ============================================================
  openAiModal(): void {
    this.aiModalOpen.set(true);
    this.aiError.set(null);
    this.aiProvider.set(null);
  }

  closeAiModal(): void {
    this.aiModalOpen.set(false);
  }

  /** Lee archivos (drag&drop / input) a base64. */
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(input.files);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.addFiles(event.dataTransfer?.files ?? null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  /** Permite pegar imágenes con Ctrl+V dentro del modal. */
  onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const it of Array.from(items)) {
      if (it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (file) this.readFileToBase64(file);
      }
    }
  }

  private addFiles(files: FileList | null): void {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (f.type.startsWith('image/')) this.readFileToBase64(f);
    }
  }

  private readFileToBase64(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.aiImagenes.update((imgs) => [...imgs, reader.result as string]);
    };
    reader.readAsDataURL(file);
  }

  removeImagen(i: number): void {
    this.aiImagenes.update((imgs) => imgs.filter((_, idx) => idx !== i));
  }

  /** Envía texto/imágenes al backend para parsear con IA. */
  procesarConIA(): void {
    const texto = this.aiTexto.trim();
    const imagenes = this.aiImagenes();
    if (!texto && imagenes.length === 0) {
      this.aiError.set('Pega texto o agrega al menos una imagen.');
      return;
    }
    this.aiLoading.set(true);
    this.aiError.set(null);
    this.scheduleAi
      .parseAI({ texto: texto || undefined, imagenes })
      .pipe(finalize(() => this.aiLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.aiProvider.set(res.provider);
          this.aplicarClasesParseadas(res.clases);
          this.aiModalOpen.set(false);
          this.aiTexto = '';
          this.aiImagenes.set([]);
        },
        error: (err) =>
          this.aiError.set(
            extractHttpErrorMessage(err, 'No se pudo interpretar el horario.'),
          ),
      });
  }

  /** Convierte las clases parseadas por IA en secciones de la grilla. */
  private aplicarClasesParseadas(clases: ParsedClass[]): void {
    const nuevas: Seccion[] = [];
    for (const c of clases) {
      const bloques: Bloque[] = [];
      for (const b of c.bloques ?? []) {
        const dia = this.diaAIndice(b.dia);
        if (dia < 0) continue;
        const inicio = this.toMin(b.horaInicio);
        const fin = this.toMin(b.horaFin);
        if (fin <= inicio) continue;
        bloques.push({ dia, inicio, fin, salon: b.salon });
      }
      if (bloques.length === 0) continue;
      const etiqueta = c.codigo ? `${c.codigo} ${c.nombre}` : c.nombre;
      nuevas.push({
        id: crypto.randomUUID(),
        materia: etiqueta.trim(),
        seccion: c.seccion || '1',
        bloques,
      });
    }
    if (nuevas.length) {
      this.secciones.update((s) => [...s, ...nuevas]);
    }
    // Quita de "proyectadas por ubicar" las que ya se poblaron.
    const codigosImportados = new Set(
      clases.map((c) => c.codigo?.replace(/[-\s]/g, '').toUpperCase()),
    );
    this.proyectadas.update((p) =>
      p.filter(
        (x) => !codigosImportados.has(x.codigo.replace(/[-\s]/g, '').toUpperCase()),
      ),
    );
  }

  private diaAIndice(dia: string): number {
    const key = dia.trim().toLowerCase();
    return key in DIA_INDEX ? DIA_INDEX[key] : -1;
  }
}
