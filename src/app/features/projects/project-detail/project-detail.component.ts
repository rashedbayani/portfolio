import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ProjectService } from '../../../core/services/project.service';
import { SeoService } from '../../../core/services/seo.service';
import { NotFoundComponent } from '../../not-found/not-found.component';

@Component({
  selector: 'app-project-detail',
  imports: [NotFoundComponent],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly projects = inject(ProjectService);
  private readonly seo = inject(SeoService);
  protected readonly project = computed(() => this.projects.getBySlug(this.params().get('slug') ?? ''));

  constructor() {
    effect(() => {
      const project = this.project();
      this.seo.update(project ? {
        ...project.seo,
        image: project.seo.image ?? project.coverImage,
        path: `/projects/${project.slug}`,
      } : { title: 'Page not found', description: 'The requested page could not be found.', path: '/404', noindex: true });
    });
  }
}
