import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateGrade, Grade, SimulationResult } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class GradesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/grades`;

  findBySubject(materiaId: string): Observable<Grade[]> {
    return this.http.get<Grade[]>(`${this.base}/subject/${materiaId}`);
  }

  create(dto: CreateGrade): Observable<Grade> {
    return this.http.post<Grade>(this.base, dto);
  }

  update(id: string, dto: Partial<CreateGrade>): Observable<Grade> {
    return this.http.patch<Grade>(`${this.base}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  average(materiaId: string): Observable<{ materiaId: string; promedioPonderado: number }> {
    return this.http.get<{ materiaId: string; promedioPonderado: number }>(
      `${this.base}/subject/${materiaId}/average`,
    );
  }

  /** Simulador "¿Cuánto necesito para pasar?". */
  simulate(materiaId: string, objetivo: number): Observable<SimulationResult> {
    const params = new HttpParams().set('objetivo', objetivo);
    return this.http.get<SimulationResult>(
      `${this.base}/subject/${materiaId}/simulate`,
      { params },
    );
  }
}
