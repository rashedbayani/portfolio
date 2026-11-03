import { BufferGeometry, CatmullRomCurve3, ExtrudeGeometry, Path, Shape, TubeGeometry, Vector3 } from 'three';

export interface RoundedOpening { x: number; y: number; width: number; height: number; radius: number; }

/** Rounded rectangle with true arcs; used for mouldings, board outlines and apertures. */
export function roundedPath<T extends Shape | Path>(path: T, width: number, height: number, radius: number, x = 0, y = 0): T {
  const left = x - width / 2, right = x + width / 2;
  const bottom = y - height / 2, top = y + height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  path.moveTo(left + r, bottom);
  path.lineTo(right - r, bottom);
  path.absarc(right - r, bottom + r, r, -Math.PI / 2, 0, false);
  path.lineTo(right, top - r);
  path.absarc(right - r, top - r, r, 0, Math.PI / 2, false);
  path.lineTo(left + r, top);
  path.absarc(left + r, top - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(left, bottom + r);
  path.absarc(left + r, bottom + r, r, Math.PI, Math.PI * 1.5, false);
  path.closePath();
  return path;
}

export function roundedPlate(width: number, height: number, thickness: number, radius: number, bevel = 0.025, openings: readonly RoundedOpening[] = []): ExtrudeGeometry {
  const shape = roundedPath(new Shape(), width, height, radius);
  for (const opening of openings) {
    shape.holes.push(roundedPath(new Path(), opening.width, opening.height, opening.radius, opening.x, opening.y));
  }
  const geometry = new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 8,
    steps: 1,
  });
  geometry.translate(0, 0, -thickness / 2);
  return geometry;
}

/** Adds the draft/slope of a moulded enclosure without rotating its level seam. */
export function slopeGeometry<T extends BufferGeometry>(geometry: T, slope: number, baseZ?: number, height = 1): T {
  const position = geometry.getAttribute('position');
  for (let index = 0; index < position.count; index++) {
    const z = position.getZ(index);
    const weight = baseZ === undefined ? 1 : Math.max(0, Math.min(1, (z - baseZ) / height));
    position.setZ(index, z + position.getY(index) * slope * weight);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function curvedTube(points: readonly (readonly [number, number, number])[], radius = 0.055): TubeGeometry {
  return new TubeGeometry(new CatmullRomCurve3(points.map(point => new Vector3(...point))), 32, radius, 8, false);
}
