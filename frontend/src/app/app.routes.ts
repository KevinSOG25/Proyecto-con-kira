import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'materias' },
  {
    path: 'materias',
    loadComponent: () =>
      import('./pages/subjects/subjects.page').then((m) => m.SubjectsPage),
  },
  {
    path: 'tareas',
    loadComponent: () =>
      import('./pages/tasks/tasks.page').then((m) => m.TasksPage),
  },
  {
    path: 'planeacion',
    loadComponent: () =>
      import('./pages/planning/planning.page').then((m) => m.PlanningPage),
  },
  {
    path: 'ia',
    loadComponent: () =>
      import('./pages/ai-center/ai-center.page').then((m) => m.AiCenterPage),
  },
  { path: '**', redirectTo: 'materias' },
];
