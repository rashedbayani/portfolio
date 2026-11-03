import { DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';

export function createProductMaterials() {
  return {
    housing: new MeshPhysicalMaterial({ color: '#e9e7df', roughness: 0.48, metalness: 0.02, clearcoat: 0.18, clearcoatRoughness: 0.5 }),
    interior: new MeshStandardMaterial({ color: '#b7bab4', roughness: 0.65 }),
    frame: new MeshStandardMaterial({ color: '#a8ada8', roughness: 0.45, metalness: 0.18 }),
    graphite: new MeshStandardMaterial({ color: '#242b2c', roughness: 0.32, metalness: 0.12 }),
    rubber: new MeshStandardMaterial({ color: '#202526', roughness: 0.86 }),
    pcb: new MeshStandardMaterial({ color: '#14594c', roughness: 0.55, metalness: 0.14 }),
    chip: new MeshStandardMaterial({ color: '#222a29', roughness: 0.66 }),
    ceramic: new MeshStandardMaterial({ color: '#ab9572', roughness: 0.6 }),
    copper: new MeshStandardMaterial({ color: '#b28c52', roughness: 0.32, metalness: 0.74 }),
    metal: new MeshStandardMaterial({ color: '#c4cbcc', roughness: 0.34, metalness: 0.8 }),
    darkMetal: new MeshStandardMaterial({ color: '#747f82', roughness: 0.4, metalness: 0.72 }),
    orange: new MeshPhysicalMaterial({ color: '#b96c3e', roughness: 0.46, clearcoat: 0.2 }),
    tubing: new MeshPhysicalMaterial({ color: '#adb8b2', roughness: 0.42, transparent: true, opacity: 0.72, side: DoubleSide }),
    lens: new MeshPhysicalMaterial({ color: '#c5d3d0', roughness: 0.14, transparent: true, opacity: 0.12, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.16, depthWrite: false }),
    battery: new MeshStandardMaterial({ color: '#aaaeb0', roughness: 0.35, metalness: 0.55 }),
  };
}

export type ProductMaterials = ReturnType<typeof createProductMaterials>;
