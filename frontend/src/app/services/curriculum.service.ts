import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApprovedCourseDto,
  CloseSemesterPayload,
  CloseSemesterResult,
  CreateCurriculumItem,
  CriticalPathNode,
  CurriculumItem,
  CurriculumResponse,
  DegreeAuditResponse,
  DiscCatalog,
  GeminiProjection,
  ReopenSemesterResult,
  SemesterHistoryResponse,
  SimulateNextSemesterResult,
  StartSemesterPayload,
  StartSemesterResult,
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

  projectSemester(payload: {
    aprobadas: string[];
    enCurso: string[];
    creditosObjetivo?: number;
  }): Observable<GeminiProjection> {
    return this.http.post<GeminiProjection>(
      `${this.base}/project-semester`,
      payload,
    );
  }

  criticalPath(): Observable<CriticalPathNode[]> {
    return this.http.get<CriticalPathNode[]>(`${this.base}/critical-path`);
  }

  discCatalog(): Observable<DiscCatalog> {
    return this.http.get<DiscCatalog>(`${this.base}/disc-catalog`);
  }

  getDegreeAudit(
    aprobadas: string[],
    enCurso: string[] = [],
  ): Observable<DegreeAuditResponse> {
    let params = new HttpParams();
    if (aprobadas.length) params = params.set('aprobadas', aprobadas.join(','));
    if (enCurso.length) params = params.set('enCurso', enCurso.join(','));
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

  // ---- Ciclo de vida multi-semestre ----

  /** Cierra y archiva el semestre actual, consolidando el snapshot. */
  closeSemester(payload: CloseSemesterPayload): Observable<CloseSemesterResult> {
    return this.http.post<CloseSemesterResult>(
      `${this.base}/close-semester`,
      payload,
    );
  }

  /** Historial de semestres cerrados con promedios y desglose. */
  history(): Observable<SemesterHistoryResponse> {
    return this.http.get<SemesterHistoryResponse>(`${this.base}/history`);
  }

  /** Materias aprobadas persistidas en el servidor. */
  approvedCourses(): Observable<ApprovedCourseDto[]> {
    return this.http.get<ApprovedCourseDto[]>(`${this.base}/approved-courses`);
  }

  /** Inicia un nuevo semestre (vacío o con códigos del pensum). */
  startSemester(payload: StartSemesterPayload): Observable<StartSemesterResult> {
    return this.http.post<StartSemesterResult>(
      `${this.base}/start-semester`,
      payload,
    );
  }

  /** Reabre un semestre archivado (deshace el cierre). */
  reopenSemester(periodo: string): Observable<ReopenSemesterResult> {
    return this.http.post<ReopenSemesterResult>(
      `${this.base}/reopen-semester`,
      { periodo },
    );
  }
}
