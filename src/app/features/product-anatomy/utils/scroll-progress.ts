export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Exact endpoints are essential: there is no residual easing or motion at completion. */
export function intervalProgress(progress: number, start: number, end: number): number {
  return clamp01((progress - start) / Math.max(0.0001, end - start));
}

export function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/** The last word reaches 1 only when the shared assembly progress reaches 1. */
export function wordProgress(progress: number, index: number, count: number): number {
  return smoothstep(intervalProgress(progress, index / count, (index + 1) / count));
}
