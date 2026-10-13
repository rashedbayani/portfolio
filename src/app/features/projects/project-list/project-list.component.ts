import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../core/services/seo.service';
import { ProjectService } from '../../../core/services/project.service';

@Component({
  selector: 'app-project-list',
  imports: [RouterLink],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectListComponent {
  protected readonly projects = inject(ProjectService).projects;
  constructor() {
    inject(SeoService).update({ title: 'Projects', description: 'Explore selected product, brand, and editorial design projects.', path: '/projects' });
  }
}
