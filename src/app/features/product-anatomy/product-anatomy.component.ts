import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, NgZone, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-product-anatomy',
  templateUrl: './product-anatomy.component.html',
  styleUrl: './product-anatomy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductAnatomyComponent {
  readonly paragraph = 'Great product design is more than what meets the eye. Beneath every surface lies a careful balance of engineering, usability, and human-centered thinking. From the smallest electronic component to the outermost shell, every decision contributes to a product that feels intuitive, reliable, and thoughtfully designed.';
  readonly words = this.paragraph.split(' ');
  readonly ready = signal(false);
  readonly staticMode = signal(true);
  private readonly section = viewChild.required<ElementRef<HTMLElement>>('section');
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly copy = viewChild.required<ElementRef<HTMLElement>>('copy');
  private readonly meter = viewChild.required<ElementRef<HTMLElement>>('meter');
  private readonly progressLabel = viewChild.required<ElementRef<HTMLElement>>('progressLabel');
  private readonly phaseLabel = viewChild.required<ElementRef<HTMLElement>>('phaseLabel');
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);

  constructor() {
    // afterNextRender never runs during SSG. No browser libraries enter the critical page bundle.
    afterNextRender(() => this.zone.runOutsideAngular(() => {
      let cleanup: (() => void) | undefined;
      let loading = false;
      const observer = new IntersectionObserver(entries => {
        if (loading || !entries.some(entry => entry.isIntersecting)) return;
        loading = true;
        observer.disconnect();
        void import('./three/product-experience').then(({ createProductExperience }) => {
          if (this.destroyRef.destroyed) return;
          cleanup = createProductExperience({
            section: this.section().nativeElement,
            stage: this.stage().nativeElement,
            viewport: this.viewport().nativeElement,
            words: [...this.copy().nativeElement.querySelectorAll<HTMLElement>('.reveal-word')],
            meter: this.meter().nativeElement,
            progressLabel: this.progressLabel().nativeElement,
            phaseLabel: this.phaseLabel().nativeElement,
            onReady: value => this.ready.set(value),
            onStatic: value => this.staticMode.set(value),
          });
        }).catch(() => {
          // The prerendered illustration and readable anatomy description remain available.
          this.ready.set(false);
          this.staticMode.set(true);
        });
      }, { rootMargin: '700px 0px' });
      observer.observe(this.section().nativeElement);
      this.destroyRef.onDestroy(() => { observer.disconnect(); cleanup?.(); });
    }));
  }
}
