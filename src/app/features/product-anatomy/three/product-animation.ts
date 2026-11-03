import type { ProductPart } from './product-parts';
import { clamp01, intervalProgress, smoothstep } from '../utils/scroll-progress';

export type AnimationPhase = 'idle' | 'entering' | 'exploding' | 'exploded' | 'reassembling' | 'complete';

/** The only writer of part transforms. Entry and scroll are inputs to the same composition. */
export class ProductAnimation {
  phase: AnimationPhase = 'idle';
  private entry = 0;
  private entered = false;
  private maximumSeparation = 0;

  constructor(private readonly parts: readonly ProductPart[]) {}

  get hasEntered(): boolean { return this.entered; }
  get entryComplete(): boolean { return this.entry === 1; }
  get separation(): number { return this.maximumSeparation; }

  beginEntry(): void {
    if (this.entered) return;
    this.entered = true;
    this.phase = 'entering';
  }

  setEntryProgress(value: number): void {
    this.entry = clamp01(value);
    this.phase = this.entry === 1 ? 'exploded' : 'exploding';
  }

  finishEntry(): void {
    this.entered = true;
    this.entry = 1;
  }

  update(progress: number, elapsed: number, floating = true): void {
    const p = clamp01(progress);
    this.maximumSeparation = 0;
    if (p === 1) this.phase = 'complete';
    else if (this.entry === 1) this.phase = p === 0 ? 'exploded' : 'reassembling';

    for (const part of this.parts) {
      // Copy the stored original, not an interpolation approximation, at the final endpoint.
      if (p === 1 || this.entry === 0) {
        part.group.position.copy(part.assembledPosition);
        part.group.quaternion.copy(part.assembledQuaternion);
        continue;
      }
      const local = smoothstep(intervalProgress(p, part.assemblyStart, part.assemblyEnd));
      const entry = smoothstep(intervalProgress(this.entry, part.explosionDelay, 1));
      const separation = entry * (1 - local);
      this.maximumSeparation = Math.max(this.maximumSeparation, separation);
      if (separation === 1) {
        part.group.position.copy(part.explodedPosition);
        part.group.quaternion.copy(part.explodedQuaternion);
      } else {
        part.group.position.lerpVectors(part.assembledPosition, part.explodedPosition, separation);
        part.group.quaternion.slerpQuaternions(part.assembledQuaternion, part.explodedQuaternion, separation);
      }
      // Fade both at the global endpoint and at each part's own seat; never disturb a seated part.
      const weight = floating ? separation * (1 - p) : 0;
      part.group.position.z += Math.sin(elapsed * part.hoverFrequency + part.hoverPhase) * part.hoverAmplitude * weight;
      part.group.position.x += Math.cos(elapsed * part.hoverFrequency * 0.7 + part.hoverPhase) * part.hoverAmplitude * 0.25 * weight;
    }
  }
}
