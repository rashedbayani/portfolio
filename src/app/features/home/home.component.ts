import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SeoService } from '../../core/services/seo.service';
import { PlusGridBackgroundComponent } from '../../shared/plus-grid-background/plus-grid-background.component';
import { BorderGlowComponent } from '../../shared/border-glow/border-glow.component';
import { SpecularButtonComponent } from '../../shared/specular-button/specular-button.component';

type FeatureCard = {
  icon: 'sparkles' | 'compass' | 'layers';
  title: string;
  description: string;
};

@Component({
  selector: 'app-home',
  imports: [PlusGridBackgroundComponent, BorderGlowComponent, SpecularButtonComponent],
  templateUrl: './home.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly featureCards: readonly FeatureCard[] = [
    {
      icon: 'sparkles',
      title: 'Human-Centered Thinking',
      description:
        'Translating complex user needs and real-world challenges into meaningful design opportunities through research, empathy, and strategic problem-solving.',
    },
    {
      icon: 'compass',
      title: 'Purposeful Product Innovation',
      description:
        'Transforming ambitious ideas into intuitive, functional products by balancing creative exploration, technical expertise, and practical constraints.',
    },
    {
      icon: 'layers',
      title: 'Precision in Every Detail',
      description:
        'Bringing together refined aesthetics, thoughtful ergonomics, and manufacturing awareness to create sophisticated products designed for lasting impact.',
    },
  ];

  constructor() {
    inject(SeoService).update({
      title: 'Home',
      description: 'Creating purposeful products that improve the way people live, work, and heal.',
      path: '/',
    });
  }
}
