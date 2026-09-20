import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SubjectsService } from '../../services/subjects.service';
import { TasksService } from '../../services/tasks.service';
import { CreateTask, Subject, Task } from '../../models/api.models';

@Component({
  selector: 'app-tasks-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './tasks.page.html',
  styleUrl: './tasks.page.scss',
})
export class TasksPage implements OnInit {
  private subjectsService = inject(SubjectsService);
  private tasksService = inject(TasksService);

  subjects = signal<Subject[]>([]);
  tasks = signal<Task[]>([]);
  selectedSubjectId = signal<string | null>(null);
  error = signal<string | null>(null);
  info = signal<string | null>(null);

  // Formulario de nueva tarea.
  newTask: Omit<CreateTask, 'materiaId'> = {
    titulo: '',
    descripcion: '',
    fechaLimite: '',
    sincronizarCalendar: true,
  };

  ngOnInit(): void {
    this.subjectsService.findAll().subscribe({
      next: (data) => {
        this.subjects.set(data);
        if (data.length && !this.selectedSubjectId()) {
          this.onSubjectChange(data[0].id);
        }
      },
      error: () => this.error.set('No se pudieron cargar las materias.'),
    });
  }

  onSubjectChange(id: string): void {
    this.selectedSubjectId.set(id);
    this.info.set(null);
    this.tasksService.findBySubject(id).subscribe({
      next: (t) => this.tasks.set(t),
      error: () => this.error.set('No se pudieron cargar las tareas.'),
    });
  }

  createTask(): void {
    const materiaId = this.selectedSubjectId();
    if (!materiaId || !this.newTask.titulo.trim() || !this.newTask.fechaLimite) {
      this.error.set('Completa título y fecha límite.');
      return;
    }
    this.error.set(null);
    const dto: CreateTask = {
      materiaId,
      ...this.newTask,
      fechaLimite: new Date(this.newTask.fechaLimite).toISOString(),
    };
    this.tasksService.create(dto).subscribe({
      next: (t) => {
        this.tasks.update((list) =>
          [...list, t].sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite)),
        );
        if (t.googleEventId) {
          this.info.set('Tarea creada y sincronizada con Google Calendar ✔');
        } else {
          this.info.set(
            'Tarea creada. (No se sincronizó con Calendar: verifica tu sesión de Google.)',
          );
        }
        this.newTask = { titulo: '', descripcion: '', fechaLimite: '', sincronizarCalendar: true };
      },
      error: () => this.error.set('No se pudo crear la tarea.'),
    });
  }

  toggleComplete(t: Task): void {
    this.tasksService.update(t.id, { completada: !t.completada }).subscribe({
      next: (updated) =>
        this.tasks.update((list) =>
          list.map((x) => (x.id === t.id ? updated : x)),
        ),
    });
  }

  deleteTask(t: Task): void {
    this.tasksService.remove(t.id).subscribe({
      next: () => this.tasks.update((list) => list.filter((x) => x.id !== t.id)),
    });
  }

  /** ¿La fecha límite ya pasó y la tarea no está completa? */
  isOverdue(t: Task): boolean {
    return !t.completada && new Date(t.fechaLimite).getTime() < Date.now();
  }
}
