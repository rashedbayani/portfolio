import type { Group, Quaternion, Vector3 } from 'three';

/** Every transform is relative to the model root, in the same engineering coordinates. */
export interface ProductPart {
  id: string;
  group: Group;
  assembledPosition: Vector3;
  assembledQuaternion: Quaternion;
  explodedPosition: Vector3;
  explodedQuaternion: Quaternion;
  assemblyStart: number;
  assemblyEnd: number;
  explosionDelay: number;
  hoverAmplitude: number;
  hoverFrequency: number;
  hoverPhase: number;
}

export interface BloodPressureMonitor {
  root: Group;
  parts: ProductPart[];
}
