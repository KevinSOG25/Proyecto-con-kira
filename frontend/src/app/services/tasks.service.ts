import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateTask, Task } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class TasksService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/tasks`;

  findBySubject(materiaId: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.base}/subject/${materiaId}`);
  }

  create(dto: CreateTask): Observable<Task> {
    return this.http.post<Task>(this.base, dto);
  }

  update(id: string, dto: Partial<CreateTask> & { completada?: boolean }): Observable<Task> {
    return this.http.patch<Task>(`${this.base}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
