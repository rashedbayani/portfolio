import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { NgStyle, isPlatformBrowser } from '@angular/common';

const DEFAULT_COLORS = ['#f97316', '#ef4444', '#eab308'] as const;
const GRADIENT_POSITIONS = [
  '80% 55%',
  '69% 34%',
  '8% 6%',
  '41% 38%',
  '86% 85%',
  '82% 18%',
  '51% 4%',
] as const;
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1] as const;

type StyleMap = Record<string, string | number>;

function parseHsl(value: string): { h: number; s: number; l: number } {
  const match = value.match(/([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?/);
  if (!match) return { h: 40, s: 80, l: 80 };
  return {
    h: Number.parseFloat(match[1]),
    s: Number.parseFloat(match[2]),
    l: Number.parseFloat(match[3]),
  };
}

function buildBoxShadow(glowColor: string, intensity: number): string {
  const { h, s, l } = parseHsl(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  const layers: [number, number, number, number, number, boolean][] = [
    [0, 0, 0, 1, 100, true],
    [0, 0, 1, 0, 60, true],
    [0, 0, 3, 0, 50, true],
    [0, 0, 6, 0, 40, true],
    [0, 0, 15, 0, 30, true],
    [0, 0, 25, 2, 20, true],
    [0, 0, 50, 2, 10, true],
    [0, 0, 1, 0, 60, false],
    [0, 0, 3, 0, 50, false],
    [0, 0, 6, 0, 40, false],
    [0, 0, 15, 0, 30, false],
    [0, 0, 25, 2, 20, false],
    [0, 0, 50, 2, 10, false],
  ];

  return layers
    .map(([x, y, blur, spread, alpha, inset]) => {
      const opacity = Math.min(alpha * intensity, 100);
      return `${inset ? 'inset ' : ''}${x}px ${y}px ${blur}px ${spread}px hsl(${base} / ${opacity}%)`;
    })
    .join(', ');
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function easeInCubic(value: number): number {
  return value * value * value;
}

function buildMeshGradients(colors: readonly string[]): string[] {
  const palette = colors.length ? colors : DEFAULT_COLORS;
  const gradients = GRADIENT_POSITIONS.map((position, index) => {
    const color = palette[Math.min(COLOR_MAP[index], palette.length - 1)];
    return `radial-gradient(at ${position}, ${color} 0px, transparent 50%)`;
  });
  gradients.push(`linear-gradient(${palette[0]} 0 100%)`);
  return gradients;
}

function isLightColor(color: string): boolean {
  const value = color.trim().replace('#', '');
  if (!/^[\da-f]{3}([\da-f]{3})?$/i.test(value)) return false;
  const hex =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722 > 180;
}

@Component({
  selector: 'app-border-glow',
  imports: [NgStyle],
  templateUrl: './border-glow.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BorderGlowComponent {
  readonly className = input('');
  readonly edgeSensitivity = input(30);
  readonly glowColor = input('40 80 80');
  readonly backgroundColor = input('#120F17');
  readonly borderRadius = input(28);
  readonly glowRadius = input(40);
  readonly glowIntensity = input(1);
  readonly coneSpread = input(25);
  readonly animated = input(false);
  readonly colors = input<readonly string[]>(DEFAULT_COLORS);
  readonly fillOpacity = input(0.5);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly hovered = signal(false);
  private readonly cursorAngle = signal(45);
  private readonly edgeProximity = signal(0);
  private readonly sweepActive = signal(false);

  private readonly normalizedSensitivity = computed(() =>
    Math.min(Math.max(this.edgeSensitivity(), 0), 99),
  );
  private readonly visible = computed(() => this.hovered() || this.sweepActive());
  private readonly borderOpacity = computed(() => {
    if (!this.visible()) return 0;
    const threshold = Math.min(this.normalizedSensitivity() + 20, 99);
    return Math.min(Math.max((this.edgeProximity() * 100 - threshold) / (100 - threshold), 0), 1);
  });
  private readonly glowOpacity = computed(() => {
    if (!this.visible()) return 0;
    const threshold = this.normalizedSensitivity();
    return Math.min(Math.max((this.edgeProximity() * 100 - threshold) / (100 - threshold), 0), 1);
  });
  private readonly angle = computed(() => `${this.cursorAngle().toFixed(3)}deg`);
  private readonly lightSurface = computed(() => isLightColor(this.backgroundColor()));
  private readonly meshGradients = computed(() => buildMeshGradients(this.colors()));
  readonly wrapperClasses = computed(() =>
    ['relative isolate grid w-full border', this.className()].filter(Boolean).join(' '),
  );

  readonly cardStyles = computed<StyleMap>(() => ({
    background: this.backgroundColor(),
    borderColor: this.lightSurface() ? 'rgb(24 24 27 / 12%)' : 'rgb(255 255 255 / 15%)',
    borderRadius: `${Math.max(this.borderRadius(), 0)}px`,
    transform: 'translate3d(0, 0, 0.01px)',
    boxShadow: this.lightSurface()
      ? 'rgb(24 24 27 / 4%) 0 1px 2px, rgb(24 24 27 / 5%) 0 8px 24px'
      : 'rgba(0,0,0,0.1) 0 1px 2px, rgba(0,0,0,0.1) 0 2px 4px, rgba(0,0,0,0.1) 0 4px 8px, rgba(0,0,0,0.1) 0 8px 16px, rgba(0,0,0,0.1) 0 16px 32px, rgba(0,0,0,0.1) 0 32px 64px',
  }));

  readonly borderStyles = computed<StyleMap>(() => ({
    border: '1px solid transparent',
    background: [
      `linear-gradient(${this.backgroundColor()} 0 100%) padding-box`,
      'linear-gradient(rgb(255 255 255 / 0%) 0% 100%) border-box',
      ...this.meshGradients().map((gradient) => `${gradient} border-box`),
    ].join(', '),
    opacity: this.borderOpacity(),
    maskImage: `conic-gradient(from ${this.angle()} at center, black ${this.coneSpread()}%, transparent ${this.coneSpread() + 15}%, transparent ${100 - this.coneSpread() - 15}%, black ${100 - this.coneSpread()}%)`,
    WebkitMaskImage: `conic-gradient(from ${this.angle()} at center, black ${this.coneSpread()}%, transparent ${this.coneSpread() + 15}%, transparent ${100 - this.coneSpread() - 15}%, black ${100 - this.coneSpread()}%)`,
    transition: this.visible() ? 'opacity 0.25s ease-out' : 'opacity 0.75s ease-in-out',
  }));

  readonly fillStyles = computed<StyleMap>(() => {
    const mask = [
      'linear-gradient(to bottom, black, black)',
      'radial-gradient(ellipse at 50% 50%, black 40%, transparent 65%)',
      'radial-gradient(ellipse at 66% 66%, black 5%, transparent 40%)',
      'radial-gradient(ellipse at 33% 33%, black 5%, transparent 40%)',
      'radial-gradient(ellipse at 66% 33%, black 5%, transparent 40%)',
      'radial-gradient(ellipse at 33% 66%, black 5%, transparent 40%)',
      `conic-gradient(from ${this.angle()} at center, transparent 5%, black 15%, black 85%, transparent 95%)`,
    ].join(', ');

    return {
      border: '1px solid transparent',
      background: this.meshGradients()
        .map((gradient) => `${gradient} padding-box`)
        .join(', '),
      maskImage: mask,
      WebkitMaskImage: mask,
      maskComposite: 'subtract, add, add, add, add, add',
      WebkitMaskComposite:
        'source-out, source-over, source-over, source-over, source-over, source-over',
      opacity: this.borderOpacity() * this.fillOpacity(),
      mixBlendMode: this.lightSurface() ? 'normal' : 'soft-light',
      transition: this.visible() ? 'opacity 0.25s ease-out' : 'opacity 0.75s ease-in-out',
    };
  });

  readonly outerGlowStyles = computed<StyleMap>(() => ({
    inset: `${-Math.max(this.glowRadius(), 0)}px`,
    maskImage: `conic-gradient(from ${this.angle()} at center, black 2.5%, transparent 10%, transparent 90%, black 97.5%)`,
    WebkitMaskImage: `conic-gradient(from ${this.angle()} at center, black 2.5%, transparent 10%, transparent 90%, black 97.5%)`,
    opacity: this.glowOpacity(),
    mixBlendMode: this.lightSurface() ? 'normal' : 'plus-lighter',
    transition: this.visible() ? 'opacity 0.25s ease-out' : 'opacity 0.75s ease-in-out',
  }));

  readonly innerGlowStyles = computed<StyleMap>(() => ({
    inset: `${Math.max(this.glowRadius(), 0)}px`,
    boxShadow: buildBoxShadow(this.glowColor(), Math.max(this.glowIntensity(), 0)),
  }));

  constructor() {
    effect((onCleanup) => {
      if (!isPlatformBrowser(this.platformId) || !this.animated()) return;

      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) return;

      const angleStart = 110;
      const angleEnd = 465;
      const startTime = performance.now();
      let frame = 0;
      this.sweepActive.set(true);
      this.cursorAngle.set(angleStart);

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const proximity =
          elapsed < 500
            ? easeOutCubic(Math.max(elapsed / 500, 0))
            : elapsed < 2500
              ? 1
              : 1 - easeInCubic(Math.min((elapsed - 2500) / 1500, 1));
        const angleProgress =
          elapsed < 1500
            ? 0.5 * easeInCubic(Math.max(elapsed / 1500, 0))
            : elapsed < 3750
              ? 0.5 + 0.5 * easeOutCubic((elapsed - 1500) / 2250)
              : 1;

        this.edgeProximity.set(proximity);
        this.cursorAngle.set(angleStart + (angleEnd - angleStart) * angleProgress);

        if (elapsed < 4000) {
          frame = requestAnimationFrame(tick);
        } else {
          this.edgeProximity.set(0);
          this.sweepActive.set(false);
        }
      };

      frame = requestAnimationFrame(tick);
      onCleanup(() => {
        cancelAnimationFrame(frame);
        this.sweepActive.set(false);
      });
    });
  }

  onPointerMove(event: PointerEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const width = Math.max(rect.width, 1);
    const height = Math.max(rect.height, 1);
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const dx = x - width / 2;
    const dy = y - height / 2;

    this.edgeProximity.set(
      Math.min(Math.max(Math.max(Math.abs(dx) / (width / 2), Math.abs(dy) / (height / 2)), 0), 1),
    );
    if (dx === 0 && dy === 0) {
      this.cursorAngle.set(0);
      return;
    }

    const degrees = (Math.atan2(dy, dx) * (180 / Math.PI) + 90 + 360) % 360;
    this.cursorAngle.set(degrees);
  }

  onPointerEnter(): void {
    this.hovered.set(true);
  }

  onPointerLeave(): void {
    this.hovered.set(false);
  }
}
