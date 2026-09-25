import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateSubject,
  ImportSubjectPayload,
  Subject,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class SubjectsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/subjects`;

  findAll(): Observable<Subject[]> {
    return this.http.get<Subject[]>(this.base);
  }

  /** Importa una materia + cortes desde el análisis de un syllabus. */
  import(payload: ImportSubjectPayload): Observable<Subject> {
    return this.http.post<Subject>(`${this.base}/import`, payload);
  }

  findOne(id: string): Observable<Subject> {
    return this.http.get<Subject>(`${this.base}/${id}`);
  }

  create(dto: CreateSubject): Observable<Subject> {
    return this.http.post<Subject>(this.base, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
