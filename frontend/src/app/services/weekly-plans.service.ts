import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UpsertWeeklyPlan, WeeklyPlan } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class WeeklyPlansService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/weekly-plans`;

  /** Lista las planeaciones del usuario. materiaId opcional ('null' = generales). */
  findAll(materiaId?: string): Observable<WeeklyPlan[]> {
    let params = new HttpParams();
    if (materiaId !== undefined) {
      params = params.set('materiaId', materiaId);
    }
    return this.http.get<WeeklyPlan[]>(this.base, { params });
  }

  /** Crea o actualiza (upsert) la planeación de una semana. */
  upsert(dto: UpsertWeeklyPlan): Observable<WeeklyPlan> {
    return this.http.post<WeeklyPlan>(this.base, dto);
  }

  /** Actualiza el contenido de una planeación existente. */
  update(id: string, content: string): Observable<WeeklyPlan> {
    return this.http.put<WeeklyPlan>(`${this.base}/${id}`, { content });
  }
}
