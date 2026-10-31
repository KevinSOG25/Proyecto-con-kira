import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type ActivityTipo =
  | 'Parcial'
  | 'Quiz'
  | 'Entrega'
  | 'Laboratorio'
  | 'Estudio'
  | 'Otro';

export type ActivityDestino = 'local' | 'google' | 'ambos';

export interface CalendarActivity {
  id: string;
  googleUserId: string;
  titulo: string;
  materiaId: string | null;
  materiaLabel: string | null;
  tipo: ActivityTipo | string;
  inicio: string;
  fin: string;
  destino: ActivityDestino | string;
  googleEventId: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GoogleEvent {
  id: string;
  titulo: string;
  inicio: string | null;
  fin: string | null;
  allDay: boolean;
}

export interface CreateCalendarActivity {
  titulo: string;
  materiaId?: string | null;
  materiaLabel?: string | null;
  tipo?: ActivityTipo;
  inicio: string;
  fin: string;
  destino?: ActivityDestino;
}

export interface UpdateCalendarActivity {
  titulo?: string;
  materiaId?: string | null;
  materiaLabel?: string | null;
  tipo?: ActivityTipo;
  inicio?: string;
  fin?: string;
}

@Injectable({ providedIn: 'root' })
export class CalendarActivitiesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/calendar-activities`;

  /** Lista las actividades locales del usuario (rango opcional). */
  findAll(desde?: string, hasta?: string): Observable<CalendarActivity[]> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<CalendarActivity[]>(this.base, { params });
  }

  /** Eventos de Google Calendar (para las vistas "Solo Google" / "Ambos"). */
  findGoogleEvents(desde?: string, hasta?: string): Observable<GoogleEvent[]> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<GoogleEvent[]>(`${this.base}/google`, { params });
  }

  create(dto: CreateCalendarActivity): Observable<CalendarActivity> {
    return this.http.post<CalendarActivity>(this.base, dto);
  }

  update(id: string, dto: UpdateCalendarActivity): Observable<CalendarActivity> {
    return this.http.patch<CalendarActivity>(`${this.base}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
