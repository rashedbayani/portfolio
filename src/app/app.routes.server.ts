import { inject } from '@angular/core';
import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';
import { ProjectService } from './core/services/project.service';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'projects/:slug',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.None,
    async getPrerenderParams() {
      return inject(ProjectService).projects.map(project => ({ slug: project.slug }));
    },
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
