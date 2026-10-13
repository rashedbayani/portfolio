import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent) },
  { path: 'about', loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent) },
  { path: 'projects', loadComponent: () => import('./features/projects/project-list/project-list.component').then(m => m.ProjectListComponent) },
  { path: 'projects/:slug', loadComponent: () => import('./features/projects/project-detail/project-detail.component').then(m => m.ProjectDetailComponent) },
  { path: '404', loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent) },
  { path: '**', loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent) },
];
