import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, NgZone, viewChild } from '@angular/core';

interface Marker { x: number; y: number; dx: number; dy: number; vx: number; vy: number; }

@Component({
  selector: 'app-plus-grid-background',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<canvas #canvas aria-hidden="true"></canvas>',
  styles: `:host { position: absolute; inset: 0; pointer-events: none; z-index: -1; } canvas { display: block; width: 100%; height: 100%; }`,
})
export class PlusGridBackgroundComponent {
  readonly interactionTarget = input.required<HTMLElement>();
  readonly influenceRadius = input(210);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.initialize()));
  }

  private initialize(): void {
    const canvas = this.canvas().nativeElement;
    const context = canvas.getContext('2d');
    if (!context) return;
    const target = this.interactionTarget();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    const styles = getComputedStyle(target);
    const base = styles.getPropertyValue('--color-border').trim();
    const accent = styles.getPropertyValue('--color-accent').trim();
    let markers: Marker[] = [];
    let width = 0, height = 0, frame = 0, previousTime = 0;
    let visible = false;
    let pointer: { x: number; y: number } | null = null;
    const interactive = () => !motion.matches && finePointer.matches;

    const draw = () => {
      context.clearRect(0, 0, width, height);
      context.lineWidth = 1.2;
      for (const marker of markers) {
        const x = marker.x + marker.dx, y = marker.y + marker.dy;
        const displaced = Math.hypot(marker.dx, marker.dy) > 12;
        context.strokeStyle = displaced ? accent : base;
        context.globalAlpha = displaced ? 0.45 : 0.8;
        context.beginPath();
        context.moveTo(x - 3, y); context.lineTo(x + 3, y);
        context.moveTo(x, y - 3); context.lineTo(x, y + 3);
        context.stroke();
      }
    };
    const stop = () => { cancelAnimationFrame(frame); frame = 0; previousTime = 0; };
    const animate = (time: number) => {
      frame = 0;
      const step = previousTime ? Math.min((time - previousTime) / 16.667, 2) : 1;
      previousTime = time;
      let moving = false;
      const radius = Math.max(1, this.influenceRadius());
      for (const marker of markers) {
        let tx = 0, ty = 0;
        if (pointer) {
          const x = marker.x - pointer.x, y = marker.y - pointer.y;
          const distance = Math.hypot(x, y);
          if (distance < radius) {
            const force = 32 * (1 - distance / radius) ** 2;
            tx = (distance > 0.01 ? x / distance : 1) * force;
            ty = (distance > 0.01 ? y / distance : 0) * force;
          }
        }
        marker.vx = (marker.vx + (tx - marker.dx) * 0.085 * step) * Math.pow(0.65, step);
        marker.vy = (marker.vy + (ty - marker.dy) * 0.085 * step) * Math.pow(0.65, step);
        marker.dx += marker.vx * step; marker.dy += marker.vy * step;
        if (Math.abs(tx - marker.dx) + Math.abs(ty - marker.dy) + Math.abs(marker.vx) + Math.abs(marker.vy) > 0.025) moving = true;
        else { marker.dx = tx; marker.dy = ty; marker.vx = marker.vy = 0; }
      }
      draw();
      if (moving) wake();
      else previousTime = 0;
    };
    const wake = () => {
      if (!frame && visible && !document.hidden && interactive()) frame = requestAnimationFrame(animate);
    };
    const reset = () => {
      stop(); pointer = null;
      for (const marker of markers) marker.dx = marker.dy = marker.vx = marker.vy = 0;
      draw();
    };
    const resize = () => {
      const bounds = target.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      markers = [];
      for (let y = 16; y < height; y += 32) {
        for (let x = 16; x < width; x += 32) markers.push({ x, y, dx: 0, dy: 0, vx: 0, vy: 0 });
      }
      reset();
    };
    const move = (event: PointerEvent) => {
      if (!interactive() || event.pointerType === 'touch') return;
      const bounds = target.getBoundingClientRect();
      pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      wake();
    };
    const leave = () => { pointer = null; wake(); };
    const visibility = () => { if (document.hidden) reset(); };
    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (!visible) reset();
    });
    resizeObserver.observe(target);
    intersectionObserver.observe(target);
    target.addEventListener('pointermove', move, { passive: true });
    target.addEventListener('pointerleave', leave);
    target.addEventListener('pointercancel', leave);
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', reset);
    finePointer.addEventListener('change', reset);
    this.destroyRef.onDestroy(() => {
      stop(); resizeObserver.disconnect(); intersectionObserver.disconnect();
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerleave', leave);
      target.removeEventListener('pointercancel', leave);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', reset);
      finePointer.removeEventListener('change', reset);
    });
  }
}
