import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateCurriculumItem,
  CriticalPathNode,
  CurriculumItem,
  CurriculumResponse,
  DegreeAuditResponse,
  SimulateNextSemesterResult,
  UpdateCurriculumItem,
  UpdateDegreeAudit,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class CurriculumService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/curriculum`;

  findAll(): Observable<CurriculumResponse> {
    return this.http.get<CurriculumResponse>(this.base);
  }

  create(dto: CreateCurriculumItem): Observable<CurriculumItem> {
    return this.http.post<CurriculumItem>(this.base, dto);
  }

  update(id: string, dto: UpdateCurriculumItem): Observable<CurriculumItem> {
    return this.http.patch<CurriculumItem>(`${this.base}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  restore(): Observable<CurriculumResponse> {
    return this.http.post<CurriculumResponse>(`${this.base}/restore`, {});
  }

  simulateNextSemester(aprobadas: string[]): Observable<SimulateNextSemesterResult> {
    return this.http.post<SimulateNextSemesterResult>(
      `${this.base}/simulate-next-semester`,
      { aprobadas },
    );
  }

  criticalPath(): Observable<CriticalPathNode[]> {
    return this.http.get<CriticalPathNode[]>(`${this.base}/critical-path`);
  }

  getDegreeAudit(aprobadas: string[]): Observable<DegreeAuditResponse> {
    let params = new HttpParams();
    if (aprobadas.length) params = params.set('aprobadas', aprobadas.join(','));
    return this.http.get<DegreeAuditResponse>(`${this.base}/degree-audit`, {
      params,
    });
  }

  updateDegreeAudit(dto: UpdateDegreeAudit): Observable<DegreeAuditResponse> {
    return this.http.patch<DegreeAuditResponse>(
      `${this.base}/degree-audit`,
      dto,
    );
  }
}
