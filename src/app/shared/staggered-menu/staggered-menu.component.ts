import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { gsap } from 'gsap';

export interface StaggeredMenuItem {
  readonly label: string;
  readonly ariaLabel?: string;
  readonly link: string;
}

export interface StaggeredMenuSocialItem {
  readonly label: string;
  readonly link: string;
}

/** Angular adaptation of the React Bits StaggeredMenu. */
@Component({
  selector: 'app-staggered-menu',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './staggered-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
    '(document:keydown)': 'onKeydown($event)',
    '(document:pointerdown)': 'onPointerDown($event)',
  },
})
export class StaggeredMenuComponent {
  readonly position = input<'left' | 'right'>('right');
  readonly items = input<readonly StaggeredMenuItem[]>([]);
  readonly socialItems = input<readonly StaggeredMenuSocialItem[]>([]);
  readonly displaySocials = input(true);
  readonly displayItemNumbering = input(true);
  readonly isFixed = input(false);
  readonly closeOnClickAway = input(true);
  readonly panelId = input('staggered-menu-panel');
  readonly menuOpen = output<void>();
  readonly menuClose = output<void>();
  private readonly opened = signal(false);
  readonly open = this.opened.asReadonly();
  readonly layerClasses = ['bg-accent-muted', 'bg-accent'];

  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly toggle = viewChild.required<ElementRef<HTMLButtonElement>>('toggle');
  private readonly icon = viewChild.required<ElementRef<HTMLElement>>('icon');
  private readonly layers = viewChildren<ElementRef<HTMLElement>>('layer');
  private animation?: gsap.core.Timeline;
  private initialized = false;
  private previousOverflow: string | undefined;

  constructor() {
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationStart) this.closeMenu();
      });
    // Render effects do not run during SSR/prerendering; GSAP only touches browser DOM.
    afterRenderEffect(() => {
      const opening = this.open();
      const offscreen = this.position() === 'left' ? -100 : 100;
      const panel = this.panel().nativeElement;
      const layers = this.layers().map((layer) => layer.nativeElement);
      // Rebuild entrances when rendered navigation content changes.
      this.items();
      this.socialItems();
      this.displaySocials();
      this.displayItemNumbering();
      this.updateScrollLock(opening && this.isFixed());
      this.animation?.kill();
      const labels = panel.querySelectorAll('[data-menu-label]');
      const numbers = panel.querySelectorAll('[data-menu-number]');
      const socials = panel.querySelectorAll('[data-menu-social]');
      const reduced = this.document.defaultView?.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const immediate = !this.initialized || reduced;

      if (!this.initialized) {
        gsap.set([panel, ...layers], { x: 0, xPercent: offscreen, visibility: 'visible' });
        this.initialized = true;
      }
      const timeline = gsap.timeline();
      this.animation = timeline;
      if (opening) {
        layers.forEach((layer, index) => {
          timeline.to(layer, { xPercent: 0, duration: 0.5, ease: 'power4.out' }, index * 0.07);
        });
        const start = layers.length ? (layers.length - 1) * 0.07 + 0.08 : 0;
        timeline.to(panel, { xPercent: 0, duration: 0.65, ease: 'power4.out' }, start);
        if (labels.length)
          timeline.fromTo(
            labels,
            { yPercent: 140, rotation: 10 },
            {
              yPercent: 0,
              rotation: 0,
              duration: 1,
              stagger: 0.1,
              ease: 'power4.out',
            },
            start + 0.1,
          );
        if (numbers.length)
          timeline.fromTo(
            numbers,
            { opacity: 0 },
            {
              opacity: 1,
              duration: 0.6,
              stagger: 0.08,
            },
            start + 0.2,
          );
        if (socials.length)
          timeline.fromTo(
            socials,
            { y: 25, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.55,
              stagger: 0.08,
              clearProps: 'opacity',
            },
            start + 0.26,
          );
      } else {
        timeline.to(
          [panel, ...layers],
          { xPercent: offscreen, duration: 0.32, ease: 'power3.in' },
          0,
        );
      }
      timeline.to(
        this.icon().nativeElement,
        {
          rotation: opening ? 225 : 0,
          duration: opening ? 0.8 : 0.35,
          ease: 'power4.out',
        },
        0,
      );
      if (immediate) timeline.progress(1);
    });
    this.destroyRef.onDestroy(() => {
      this.animation?.kill();
      this.updateScrollLock(false);
    });
  }

  toggleMenu(): void {
    if (this.open()) this.closeMenu();
    else {
      this.opened.set(true);
      this.menuOpen.emit();
    }
  }

  closeMenu(restoreFocus = true): void {
    if (!this.open()) return;
    if (restoreFocus && this.host.nativeElement.contains(this.document.activeElement)) {
      this.toggle().nativeElement.focus({ preventScroll: true });
    }
    this.opened.set(false);
    this.menuClose.emit();
  }

  isInternal(link: string): boolean {
    return link.startsWith('/') && !link.startsWith('//');
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.open() || !this.closeOnClickAway()) return;
    const target = event.target as Node | null;
    if (
      !this.panel().nativeElement.contains(target) &&
      !this.toggle().nativeElement.contains(target)
    ) {
      this.closeMenu();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu();
    } else if (event.key === 'Tab' && this.isFixed()) {
      const controls = Array.from(
        this.host.nativeElement.querySelectorAll<HTMLElement>('a[href], button'),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && this.document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && this.document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  private updateScrollLock(lock: boolean): void {
    if (lock && this.previousOverflow === undefined) {
      this.previousOverflow = this.document.body.style.overflow;
      this.document.body.style.overflow = 'hidden';
    } else if (!lock && this.previousOverflow !== undefined) {
      this.document.body.style.overflow = this.previousOverflow;
      this.previousOverflow = undefined;
    }
  }
}
