import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AiService } from '../../services/ai.service';
import { SubjectsService } from '../../services/subjects.service';
import { SlidesAnalysis, SyllabusAnalysis } from '../../models/api.models';

@Component({
  selector: 'app-ai-center-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './ai-center.page.html',
  styleUrl: './ai-center.page.scss',
})
export class AiCenterPage {
  private ai = inject(AiService);
  private subjectsService = inject(SubjectsService);

  // Syllabus
  syllabusFile = signal<File | null>(null);
  syllabusResult = signal<SyllabusAnalysis | null>(null);
  syllabusLoading = signal(false);
  syllabusError = signal<string | null>(null);

  // Importación de la materia desde el syllabus.
  importing = signal(false);
  importError = signal<string | null>(null);
  importedSubjectName = signal<string | null>(null);

  // Diapositivas
  slidesFile = signal<File | null>(null);
  slidesResult = signal<SlidesAnalysis | null>(null);
  slidesLoading = signal(false);
  slidesError = signal<string | null>(null);

  onSyllabusSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.syllabusFile.set(input.files?.[0] ?? null);
    this.syllabusResult.set(null);
    this.syllabusError.set(null);
    this.importError.set(null);
    this.importedSubjectName.set(null);
  }

  onSlidesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.slidesFile.set(input.files?.[0] ?? null);
    this.slidesResult.set(null);
    this.slidesError.set(null);
  }

  analyzeSyllabus(): void {
    const file = this.syllabusFile();
    if (!file) return;
    this.syllabusLoading.set(true);
    this.syllabusError.set(null);
    this.importError.set(null);
    this.importedSubjectName.set(null);
    this.ai
      .analyzeSyllabus(file)
      .pipe(finalize(() => this.syllabusLoading.set(false)))
      .subscribe({
        next: (res) => this.syllabusResult.set(res),
        error: (err) =>
          this.syllabusError.set(
            err?.error?.message ?? 'No se pudo analizar el syllabus.',
          ),
      });
  }

  /**
   * Crea la materia y sus cortes en el backend a partir del análisis del
   * syllabus (endpoint POST /subjects/import).
   */
  createSubjectFromSyllabus(): void {
    const r = this.syllabusResult();
    if (!r) return;
    if (!r.materia) {
      this.importError.set('La IA no detectó el nombre de la materia.');
      return;
    }
    this.importing.set(true);
    this.importError.set(null);
    this.importedSubjectName.set(null);

    this.subjectsService
      .import({
        materia: r.materia,
        codigo: r.codigo,
        creditos: r.creditos, // si es null, el backend asigna 3
        evaluaciones: r.evaluaciones,
      })
      .pipe(finalize(() => this.importing.set(false)))
      .subscribe({
        next: (subject) => this.importedSubjectName.set(subject.nombre),
        error: (err) =>
          this.importError.set(
            err?.error?.message ??
              'No se pudo crear la materia. Verifica tu sesión de Google.',
          ),
      });
  }

  analyzeSlides(): void {
    const file = this.slidesFile();
    if (!file) return;
    this.slidesLoading.set(true);
    this.slidesError.set(null);
    this.ai
      .analyzeSlides(file)
      .pipe(finalize(() => this.slidesLoading.set(false)))
      .subscribe({
        next: (res) => this.slidesResult.set(res),
        error: (err) =>
          this.slidesError.set(
            err?.error?.message ?? 'No se pudieron analizar las diapositivas.',
          ),
      });
  }
}
