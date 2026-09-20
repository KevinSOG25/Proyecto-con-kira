import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  EmailScanResult,
  ScanEmailsRequest,
  SlidesAnalysis,
  SyllabusAnalysis,
} from '../models/api.models';

/** Servicio del Centro de IA: Gmail scan + análisis de documentos con Gemini. */
@Injectable({ providedIn: 'root' })
export class AiService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  scanEmails(req: ScanEmailsRequest): Observable<EmailScanResult[]> {
    return this.http.post<EmailScanResult[]>(`${this.api}/gmail/scan`, req);
  }

  analyzeSyllabus(file: File): Observable<SyllabusAnalysis> {
    const form = new FormData();
    form.append('file', file);
    const params = new HttpParams().set('tipo', 'syllabus');
    return this.http.post<SyllabusAnalysis>(
      `${this.api}/documents/process`,
      form,
      { params },
    );
  }

  analyzeSlides(file: File): Observable<SlidesAnalysis> {
    const form = new FormData();
    form.append('file', file);
    const params = new HttpParams().set('tipo', 'diapositivas');
    return this.http.post<SlidesAnalysis>(
      `${this.api}/documents/process`,
      form,
      { params },
    );
  }
}
