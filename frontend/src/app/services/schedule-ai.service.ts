import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ParsedClassBlock {
  dia: string;
  horaInicio: string;
  horaFin: string;
  salon?: string;
  tipo?: string;
}

export interface ParsedClass {
  codigo: string;
  nombre: string;
  seccion?: string;
  creditos?: number;
  bloques: ParsedClassBlock[];
}

export interface ParseScheduleResponse {
  clases: ParsedClass[];
  totalClases: number;
  provider: 'Gemini' | 'Groq' | 'Respaldo';
}

/** Materia proyectada que viaja desde el Pensum al Armador de Horarios. */
export interface ProjectedSubject {
  codigo: string;
  nombre: string;
  creditos: number;
}

@Injectable({ providedIn: 'root' })
export class ScheduleAiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/schedules`;

  /** Materias proyectadas pendientes de ubicar (puente Pensum -> Horarios). */
  readonly materiasProyectadas = signal<ProjectedSubject[]>([]);

  setProyectadas(materias: ProjectedSubject[]): void {
    this.materiasProyectadas.set(materias);
  }

  consumeProyectadas(): ProjectedSubject[] {
    const m = this.materiasProyectadas();
    this.materiasProyectadas.set([]);
    return m;
  }

  parseAI(payload: {
    texto?: string;
    imagenes?: string[];
    imagenMime?: string;
  }): Observable<ParseScheduleResponse> {
    return this.http.post<ParseScheduleResponse>(`${this.base}/parse-ai`, payload);
  }
}
