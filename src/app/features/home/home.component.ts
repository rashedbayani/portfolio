import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { PlusGridBackgroundComponent } from '../../shared/plus-grid-background/plus-grid-background.component';


@Component({
  selector: 'app-home',
  imports: [RouterLink, PlusGridBackgroundComponent],
  templateUrl: './home.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {

  constructor() {
    inject(SeoService).update({ title: 'Home', description: 'Creating purposeful products that improve the way people live, work, and heal.', path: '/' });
  }
}
