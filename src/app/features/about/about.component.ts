import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { SeoService } from '../../core/services/seo.service';


@Component({
  selector: 'app-about',
  imports: [],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent {

  constructor() {
    inject(SeoService).update({ title: 'About', description: 'About the designer and the approach behind the work.', path: '/about' });
  }
}
