import { NgStyle, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

const SIZES: Record<SpecularButtonSize, string> = {
  sm: 'px-5 py-2.5 text-[0.875rem]',
  md: 'px-7 py-3.5 text-[1rem]',
  lg: 'px-[38px] py-[18px] text-[1.125rem]',
};

const BUTTON_CLASSES =
  'relative isolate m-0 inline-flex cursor-pointer items-center justify-center gap-[0.5em] border-0 [font-family:inherit] font-medium leading-none tracking-[0.01em] [color:var(--sb-text-color)] [border-radius:var(--sb-radius)] [background:color-mix(in_srgb,var(--sb-tint)_calc(var(--sb-tint-opacity)*100%),transparent)] shadow-[0_10px_24px_-14px_rgba(0,0,0,0.45)] [-webkit-backdrop-filter:blur(var(--sb-blur))] [backdrop-filter:blur(var(--sb-blur))] outline-none [-webkit-tap-highlight-color:transparent] transition-transform duration-250 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-[3px] focus-visible:[outline-color:color-mix(in_srgb,var(--sb-text-color)_55%,transparent)] disabled:cursor-default disabled:opacity-50 disabled:active:scale-100';

const PAD = 24;
const TAU = Math.PI * 2;

export type SpecularButtonSize = 'sm' | 'md' | 'lg';
export type SpecularButtonType = 'button' | 'submit' | 'reset';
type StyleMap = Readonly<Record<string, string | number>>;

type Settings = {
  radius: number;
  lineColor: string;
  baseColor: string;
  intensity: number;
  idleIntensity: number;
  shineSize: number;
  shineFade: number;
  thickness: number;
  glow: number;
  speed: number;
  followMouse: boolean;
  proximity: number;
  autoAnimate: boolean;
  disabled: boolean;
};

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uRadius;
uniform float uPx;
uniform float uSpot;
uniform vec2 uEntry;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform vec2 uWindow;
uniform float uThickness;
uniform float uGlow;
out vec4 outColor;

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float loopPosition(vec2 p, vec2 b, float r) {
  vec2 inner = b - r;
  float arc = 1.5707963 * r;
  float quarter = inner.x + inner.y + arc;
  vec2 a = abs(p);
  vec2 q = a - inner;
  float s = q.x > 0.0 && q.y > 0.0
    ? inner.y + atan(q.y, q.x) * r
    : (q.x > q.y ? min(a.y, inner.y) : inner.y + arc + inner.x - min(a.x, inner.x));
  if (p.x < 0.0) s = p.y >= 0.0 ? 2.0 * quarter - s : 2.0 * quarter + s;
  else if (p.y < 0.0) s = 4.0 * quarter - s;
  return s / max(4.0 * quarter, 0.0001);
}

float lobe(float position, float center) {
  float gap = abs(fract(position - center + 0.5) - 0.5);
  return 1.0 - smoothstep(uWindow.x, uWindow.x + uWindow.y, gap);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = roundedBox(p, uHalf, uRadius);
  float position = loopPosition(p, uHalf, uRadius);
  float key = lobe(position, uSpot);
  float back = lobe(position, uSpot + 0.5);
  float streak = key + back * 0.45;
  float width = max(uThickness * uPx * mix(1.0, max(key, back), 0.6), 0.35);
  float band = smoothstep(-width - 0.6, -width + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float hair = smoothstep(-uPx - 0.6, -uPx + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float inside = 1.0 - smoothstep(-0.6, 0.6, d);
  vec2 pool = (p - uEntry) / (uHalf.y * vec2(1.6, 1.1));
  float glow = streak * 0.2 * exp(-abs(d + width * 0.5) / (5.0 * uPx)) + inside * 0.08 * exp(-dot(pool, pool));
  float light = clamp((band * streak + glow * uGlow) * uIntensity, 0.0, 1.0);
  vec4 base = vec4(uBaseColor, 1.0) * hair * 0.6;
  outColor = vec4(uLineColor, 1.0) * light + base * (1.0 - light);
}`;

const UNIFORM_NAMES = [
  'uCenter',
  'uHalf',
  'uRadius',
  'uPx',
  'uSpot',
  'uEntry',
  'uLineColor',
  'uBaseColor',
  'uIntensity',
  'uWindow',
  'uThickness',
  'uGlow',
] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wrap = (value: number) => value - Math.floor(value);

function loopPosition(x: number, y: number, halfX: number, halfY: number, radius: number): number {
  const innerX = halfX - radius;
  const innerY = halfY - radius;
  const arc = (Math.PI / 2) * radius;
  const quarter = innerX + innerY + arc;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const qx = ax - innerX;
  const qy = ay - innerY;
  let distance: number;

  if (qx > 0 && qy > 0) distance = innerY + Math.atan2(qy, qx) * radius;
  else if (qx > qy) distance = Math.min(ay, innerY);
  else distance = innerY + arc + innerX - Math.min(ax, innerX);

  if (x < 0) distance = y >= 0 ? 2 * quarter - distance : 2 * quarter + distance;
  else if (y < 0) distance = 4 * quarter - distance;
  return wrap(distance / Math.max(4 * quarter, 0.0001));
}

function rimPoint(position: number, halfX: number, halfY: number, radius: number): [number, number] {
  const innerX = halfX - radius;
  const innerY = halfY - radius;
  const arc = (Math.PI / 2) * radius;
  const quarter = innerX + innerY + arc;
  let distance = wrap(position) * 4 * quarter;
  let signX = 1;
  let signY = 1;

  if (distance > 3 * quarter) {
    distance = 4 * quarter - distance;
    signY = -1;
  } else if (distance > 2 * quarter) {
    distance -= 2 * quarter;
    signX = -1;
    signY = -1;
  } else if (distance > quarter) {
    distance = 2 * quarter - distance;
    signX = -1;
  }

  let x = innerX - (distance - innerY - arc);
  let y = halfY;
  if (distance <= innerY) {
    x = halfX;
    y = distance;
  } else if (distance <= innerY + arc) {
    const angle = (distance - innerY) / Math.max(radius, 0.0001);
    x = innerX + Math.cos(angle) * radius;
    y = innerY + Math.sin(angle) * radius;
  }
  return [x * signX, y * signY];
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function linkProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, 'aPosition');
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
}

@Component({
  selector: 'app-specular-button',
  imports: [NgStyle, NgTemplateOutlet, RouterLink],
  templateUrl: './specular-button.component.html',
  host: { class: 'inline-block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpecularButtonComponent {
  readonly size = input<SpecularButtonSize>('lg');
  readonly radius = input(18);
  readonly tint = input('#ffffff');
  readonly tintOpacity = input(0.04);
  readonly blur = input(0);
  readonly textColor = input('#f5f5f5');
  readonly lineColor = input('#ff9655');
  readonly baseColor = input('#493021');
  readonly intensity = input(1);
  readonly idleIntensity = input(0.35);
  readonly shineSize = input(10);
  readonly shineFade = input(34);
  readonly thickness = input(1.2);
  readonly glow = input(1);
  readonly speed = input(0.35);
  readonly followMouse = input(true);
  readonly proximity = input(250);
  readonly autoAnimate = input(false);
  readonly disabled = input(false);
  readonly type = input<SpecularButtonType>('button');
  readonly className = input('');
  readonly style = input<StyleMap>({});
  readonly link = input<string | null>(null);
  readonly id = input<string | null>(null);
  readonly title = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly name = input<string | null>(null);
  readonly value = input<string | null>(null);
  readonly buttonClick = output<MouseEvent>();

  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private wake: (() => void) | null = null;

  readonly settings = computed<Settings>(() => ({
    radius: Math.max(0, this.radius()),
    lineColor: this.lineColor(),
    baseColor: this.baseColor(),
    intensity: Math.max(0, this.intensity()),
    idleIntensity: clamp(this.idleIntensity(), 0, 1),
    shineSize: Math.max(0, this.shineSize()),
    shineFade: Math.max(0, this.shineFade()),
    thickness: Math.max(0, this.thickness()),
    glow: Math.max(0, this.glow()),
    speed: this.speed(),
    followMouse: this.followMouse(),
    proximity: Math.max(1, this.proximity()),
    autoAnimate: this.autoAnimate(),
    disabled: this.disabled(),
  }));

  readonly buttonClasses = computed(
    () => `${BUTTON_CLASSES} ${SIZES[this.size()] ?? SIZES.lg}${this.className() ? ` ${this.className()}` : ''}`,
  );

  readonly inlineStyles = computed<StyleMap>(() => ({
    '--sb-radius': `${Math.max(this.radius(), 0)}px`,
    '--sb-tint': this.tint(),
    '--sb-tint-opacity': this.tintOpacity(),
    '--sb-blur': `${Math.max(this.blur(), 0)}px`,
    '--sb-text-color': this.textColor(),
    ...this.style(),
  }));

  constructor() {
    effect(() => {
      this.settings();
      this.buttonClasses();
      this.inlineStyles();
      this.wake?.();
    });

    afterNextRender(() => {
      if (isPlatformBrowser(this.platformId)) this.zone.runOutsideAngular(() => this.initialize());
    });
  }

  handleClick(event: MouseEvent): void {
    if (this.disabled()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.buttonClick.emit(event);
  }

  private initialize(): void {
    const surface = this.surface().nativeElement;
    const canvas = surface.querySelector('canvas');
    const gl = canvas?.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!canvas || !gl) return;

    const program = linkProgram(gl);
    if (!program) return;
    const uniforms: Record<(typeof UNIFORM_NAMES)[number], WebGLUniformLocation | null> = {
      uCenter: gl.getUniformLocation(program, 'uCenter'),
      uHalf: gl.getUniformLocation(program, 'uHalf'),
      uRadius: gl.getUniformLocation(program, 'uRadius'),
      uPx: gl.getUniformLocation(program, 'uPx'),
      uSpot: gl.getUniformLocation(program, 'uSpot'),
      uEntry: gl.getUniformLocation(program, 'uEntry'),
      uLineColor: gl.getUniformLocation(program, 'uLineColor'),
      uBaseColor: gl.getUniformLocation(program, 'uBaseColor'),
      uIntensity: gl.getUniformLocation(program, 'uIntensity'),
      uWindow: gl.getUniformLocation(program, 'uWindow'),
      uThickness: gl.getUniformLocation(program, 'uThickness'),
      uGlow: gl.getUniformLocation(program, 'uGlow'),
    };
    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const colors = new Map<string, number[]>();
    const view = { width: 1, height: 1, ratio: 1 };
    const pointer = { x: 0, y: 0, known: false };
    const state = { spot: 0, level: 0, press: 0, ready: false };
    let frameId = 0;
    let lastTime = 0;
    let visible = true;

    const toRgb = (value: string): number[] => {
      const cached = colors.get(value);
      if (cached) return cached;
      let rgb = [1, 1, 1];
      if (probe) {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = '#000000';
        probe.fillStyle = value;
        probe.fillRect(0, 0, 1, 1);
        const [red, green, blue] = probe.getImageData(0, 0, 1, 1).data;
        rgb = [red / 255, green / 255, blue / 255];
      }
      colors.set(value, rgb);
      return rgb;
    };

    const cornerRadius = (settings: Settings) => Math.min(settings.radius, view.width / 2, view.height / 2);
    const restSpot = (settings: Settings) => {
      const radius = cornerRadius(settings);
      const inset = radius * (1 - Math.SQRT1_2);
      return loopPosition(inset - view.width / 2, view.height / 2 - inset, view.width / 2, view.height / 2, radius);
    };

    const aim = (settings: Settings) => {
      if (!settings.followMouse || settings.disabled || !pointer.known) return null;
      const rect = surface.getBoundingClientRect();
      const scale = rect.width / view.width || 1;
      const halfX = view.width / 2;
      const halfY = view.height / 2;
      const x = (pointer.x - rect.left - rect.width / 2) / scale;
      const y = (rect.top + rect.height / 2 - pointer.y) / scale;
      const distance = Math.hypot(Math.max(Math.abs(x) - halfX, 0), Math.max(Math.abs(y) - halfY, 0));
      const progress = clamp(1 - distance / settings.proximity, 0, 1);
      const near = progress * progress * (3 - 2 * progress);
      const nearest = loopPosition(x, y, halfX, halfY, cornerRadius(settings));
      if (distance > 0) return { spot: nearest, near };
      const depth = clamp(Math.min(halfX - Math.abs(x), halfY - Math.abs(y)) / (halfY * 0.8), 0, 1);
      const sway = restSpot(settings) - (x / halfX) * 0.06 - (y / halfY) * 0.02;
      const offset = sway - nearest - Math.round(sway - nearest);
      return { spot: wrap(nearest + offset * depth * depth * (3 - 2 * depth)), near };
    };

    const draw = (settings: Settings) => {
      const { width, height } = view;
      const scaleX = canvas.width / (width + PAD * 2);
      const scaleY = canvas.height / (height + PAD * 2);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(uniforms.uCenter, (PAD + width / 2) * scaleX, (PAD + height / 2) * scaleY);
      gl.uniform2f(uniforms.uHalf, (width / 2) * scaleX, (height / 2) * scaleY);
      gl.uniform1f(uniforms.uRadius, Math.min(settings.radius, width / 2, height / 2) * scaleX);
      gl.uniform1f(uniforms.uPx, view.ratio);
      const radius = Math.min(settings.radius, width / 2, height / 2);
      const [rimX, rimY] = rimPoint(state.spot, width / 2, height / 2, radius);
      const rimDistance = Math.max(Math.hypot(rimX, rimY), 0.0001);
      const pull = 1 - Math.min(0.35 * (height / 2), rimDistance) / rimDistance;
      gl.uniform1f(uniforms.uSpot, state.spot);
      gl.uniform2f(uniforms.uEntry, rimX * pull * scaleX, rimY * pull * scaleY);
      gl.uniform3fv(uniforms.uLineColor, toRgb(settings.lineColor));
      gl.uniform3fv(uniforms.uBaseColor, toRgb(settings.baseColor));
      gl.uniform1f(uniforms.uIntensity, settings.intensity * (state.level + state.press * 0.8));
      gl.uniform2f(uniforms.uWindow, settings.shineSize / 360 + state.press * 0.06, settings.shineFade / 360 + 0.0001);
      gl.uniform1f(uniforms.uThickness, settings.thickness);
      gl.uniform1f(uniforms.uGlow, settings.glow);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    };

    const animate = (now: number) => {
      frameId = 0;
      if (!visible) return;
      const settings = this.settings();
      const delta = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 1 / 60;
      lastTime = now;
      const target = aim(settings);
      const spinning = settings.autoAnimate && !reduceMotion;
      const steering = !!target && target.near > 0;

      if (!state.ready) {
        state.spot = restSpot(settings);
        state.level = settings.autoAnimate ? 1 : settings.idleIntensity;
        state.ready = true;
      }

      let difference = 0;
      if (spinning && !steering) state.spot = wrap(state.spot + (settings.speed / TAU) * delta);
      else {
        difference = (steering ? target.spot : restSpot(settings)) - state.spot;
        difference -= Math.round(difference);
        state.spot = wrap(state.spot + difference * (1 - Math.exp(-delta * 8)));
      }

      const level = settings.autoAnimate
        ? 1
        : settings.idleIntensity + (1 - settings.idleIntensity) * (target ? target.near : 0);
      state.level += (level - state.level) * (1 - Math.exp(-delta * 7));
      state.press *= Math.exp(-delta * 5);
      draw(settings);

      const settling = Math.abs(difference) > 0.0002 || Math.abs(level - state.level) > 0.001 || state.press > 0.002;
      if (settling || (spinning && !steering)) frameId = requestAnimationFrame(animate);
      else lastTime = 0;
    };

    const wake = () => {
      if (!frameId && visible) frameId = requestAnimationFrame(animate);
    };

    const measure = (entry?: ResizeObserverEntry) => {
      const boxSizes = entry?.borderBoxSize;
      const box = boxSizes ? (Array.isArray(boxSizes) ? boxSizes[0] : boxSizes) : undefined;
      view.width = Math.max(1, box ? box.inlineSize : surface.offsetWidth);
      view.height = Math.max(1, box ? box.blockSize : surface.offsetHeight);
      view.ratio = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.max(1, Math.round((view.width + PAD * 2) * view.ratio));
      canvas.height = Math.max(1, Math.round((view.height + PAD * 2) * view.ratio));
      if (state.ready) draw(this.settings());
      wake();
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.known = true;
      wake();
    };
    const onPointerDown = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.known = true;
      if (!this.settings().disabled) state.press = 1;
      wake();
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      pointer.known = false;
      wake();
    };
    const onPointerLeave = () => {
      pointer.known = false;
      wake();
    };

    const resizeObserver = new ResizeObserver((entries) => measure(entries[entries.length - 1]));
    resizeObserver.observe(surface);
    const intersectionObserver = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) {
        lastTime = 0;
        wake();
      }
    });
    intersectionObserver.observe(surface);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerEnd, { passive: true });
    window.addEventListener('pointercancel', onPointerEnd, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    surface.addEventListener('pointerdown', onPointerDown);
    measure();
    this.wake = wake;

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(frameId);
      this.wake = null;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      surface.removeEventListener('pointerdown', onPointerDown);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    });
  }
}
