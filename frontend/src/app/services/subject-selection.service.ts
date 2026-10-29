import { Injectable, signal } from '@angular/core';

/**
 * Estado compartido para pre-seleccionar una materia al navegar entre vistas
 * (p. ej. desde una tarjeta del semáforo del Dashboard hacia /materias).
 */
@Injectable({ providedIn: 'root' })
export class SubjectSelectionService {
  /** Id de la materia que debe seleccionarse al abrir la vista de Materias. */
  readonly pendingSubjectId = signal<string | null>(null);

  select(id: string): void {
    this.pendingSubjectId.set(id);
  }

  consume(): string | null {
    const id = this.pendingSubjectId();
    this.pendingSubjectId.set(null);
    return id;
  }
}
