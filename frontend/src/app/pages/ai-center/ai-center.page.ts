import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { AiService } from '../../services/ai.service';
import { SlidesAnalysis, SyllabusAnalysis } from '../../models/api.models';

@Component({
  selector: 'app-ai-center-page',
  imports: [CommonModule],
  templateUrl: './ai-center.page.html',
  styleUrl: './ai-center.page.scss',
})
export class AiCenterPage {
  private ai = inject(AiService);

  // Syllabus
  syllabusFile = signal<File | null>(null);
  syllabusResult = signal<SyllabusAnalysis | null>(null);
  syllabusLoading = signal(false);
  syllabusError = signal<string | null>(null);

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
