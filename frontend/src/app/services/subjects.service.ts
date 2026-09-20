import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateSubject, Subject } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class SubjectsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/subjects`;

  findAll(): Observable<Subject[]> {
    return this.http.get<Subject[]>(this.base);
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
