import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
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
    path: 'calendario',
    loadComponent: () =>
      import('./pages/calendar/calendar.page').then((m) => m.CalendarPage),
  },
  {
    path: 'horarios',
    loadComponent: () =>
      import('./pages/schedule/schedule.page').then((m) => m.SchedulePage),
  },
  {
    path: 'pensum',
    loadComponent: () =>
      import('./pages/pensum/pensum.page').then((m) => m.PensumPage),
  },
  {
    path: 'ia',
    loadComponent: () =>
      import('./pages/ai-center/ai-center.page').then((m) => m.AiCenterPage),
  },
  { path: '**', redirectTo: '' },
];
