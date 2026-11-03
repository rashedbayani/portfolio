import {
  BoxGeometry, CanvasTexture, CircleGeometry, CylinderGeometry, DoubleSide, Group, InstancedMesh,
  Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, Quaternion,
  RingGeometry, SRGBColorSpace, TorusGeometry, Vector3,
  type BufferGeometry, type Material,
} from 'three';
import { curvedTube, roundedPlate, slopeGeometry } from '../utils/geometry-helpers';
import { createProductMaterials } from './product-materials';
import type { BloodPressureMonitor, ProductPart } from './product-parts';

const SLOPE = 0.11;
const FACE_TILT = Math.atan(SLOPE);

/**
 * Original, illustrative engineering concept. All dimensions and component relationships are
 * authored here; there are no downloaded models or external texture assets.
 * X = width, Y = depth (front is negative), Z = up. One unit is approximately 35 mm.
 */
export function createBloodPressureMonitor(): BloodPressureMonitor {
  const root = new Group();
  root.name = 'Digital blood pressure monitor / procedural engineering concept';
  const parts: ProductPart[] = [];
  const mat = createProductMaterials();
  const geometryCache = new Map<string, BufferGeometry>();
  const cached = (key: string, build: () => BufferGeometry): BufferGeometry => {
    let geometry = geometryCache.get(key);
    if (!geometry) { geometry = build(); geometryCache.set(key, geometry); }
    return geometry;
  };
  const box = (x: number, y: number, z: number): BufferGeometry => cached(`b:${x}:${y}:${z}`, () => new BoxGeometry(x, y, z));
  const plate = (x: number, y: number, z: number, r = 0.05, bevel = 0.012): BufferGeometry =>
    cached(`p:${x}:${y}:${z}:${r}:${bevel}`, () => roundedPlate(x, y, z, r, bevel));
  const cylinder = (r: number, h: number, r2 = r, segments = 32): BufferGeometry =>
    cached(`c:${r}:${h}:${r2}:${segments}`, () => new CylinderGeometry(r, r2, h, segments));

  function mesh(parent: Group, geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0): Mesh {
    const object = new Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function disc(parent: Group, r: number, h: number, material: Material, x: number, y: number, z: number, r2 = r): Mesh {
    const object = mesh(parent, cylinder(r, h, r2), material, x, y, z);
    object.rotation.x = Math.PI / 2;
    return object;
  }
  function tube(parent: Group, points: readonly (readonly [number, number, number])[], material: Material = mat.tubing, radius = 0.052): Mesh {
    return mesh(parent, curvedTube(points, radius), material);
  }
  function register(id: string, group: Group, offset: readonly [number, number, number], start: number, end: number, delay = 0, rotation: readonly [number, number, number] = [0, 0, 0]): void {
    group.name = id;
    root.add(group);
    const explodedQuaternion = new Quaternion().setFromEuler(new Object3D().rotation.set(...rotation));
    parts.push({
      id, group,
      assembledPosition: group.position.clone(), assembledQuaternion: group.quaternion.clone(),
      explodedPosition: group.position.clone().add(new Vector3(...offset)), explodedQuaternion,
      assemblyStart: start, assemblyEnd: end, explosionDelay: delay,
      hoverAmplitude: 0.017 + (parts.length % 3) * 0.004,
      hoverFrequency: 0.7 + (parts.length % 4) * 0.11,
      hoverPhase: parts.length * 1.37,
    });
  }

  // Lower tray: a thick floor and hollow, rounded moulded wall rather than a solid block.
  const lower = new Group();
  mesh(lower, roundedPlate(3.45, 3.75, 0.14, 0.46, 0.055), mat.housing, 0, 0, -0.57);
  mesh(lower, roundedPlate(3.45, 3.75, 0.56, 0.46, 0.018, [
    { x: 0, y: 0, width: 3.16, height: 3.46, radius: 0.33 },
  ]), mat.housing, 0, 0, -0.22);
  mesh(lower, roundedPlate(3.46, 3.76, 0.018, 0.46, 0.003, [
    { x: 0, y: 0, width: 3.2, height: 3.5, radius: 0.34 },
  ]), mat.graphite, 0, 0, 0.058);
  for (const x of [-1.32, 1.32]) {
    for (const y of [-1.43, 1.43]) {
      disc(lower, 0.16, 0.1, mat.rubber, x, y, -0.69);
      disc(lower, 0.108, 0.38, mat.interior, x, y, -0.3);
      disc(lower, 0.045, 0.405, mat.graphite, x, y, -0.29);
    }
  }
  for (let index = 0; index < 7; index++) {
    mesh(lower, box(0.009, 0.25, 0.034), mat.rubber, 1.729, 0.64 - index * 0.19, -0.16);
  }
  // Recessed battery service panel and restrained underside marking.
  mesh(lower, roundedPlate(1.5, 2.65, 0.028, 0.15, 0.009), mat.interior, -0.57, 0, -0.655);
  mesh(lower, plate(0.3, 0.08, 0.035, 0.025), mat.graphite, -0.57, -1.22, -0.68);
  register('lower-housing', lower, [-0.25, 0.45, -1.12], 0, 0.34, 0.015);

  // Internal chassis, retaining rails and board mounting bosses, all with real openings.
  const frame = new Group();
  mesh(frame, roundedPlate(2.98, 3.22, 0.1, 0.2, 0.016, [
    { x: -0.65, y: 0, width: 1.22, height: 2.7, radius: 0.12 },
    { x: 0.79, y: 0.44, width: 1.1, height: 1.55, radius: 0.12 },
    { x: 0.79, y: -1.0, width: 1.1, height: 0.78, radius: 0.1 },
  ]), mat.frame, 0, 0, 0.12);
  for (const x of [-1.32, 1.32]) {
    mesh(frame, plate(0.1, 2.58, 0.35, 0.03), mat.interior, x, 0, -0.07);
    for (const y of [-1.38, 1.38]) {
      disc(frame, 0.105, 0.18, mat.interior, x, y, 0.24);
      disc(frame, 0.045, 0.19, mat.copper, x, y, 0.245);
    }
  }
  register('structural-frame', frame, [-0.18, 0.22, -0.38], 0.04, 0.39, 0.045);

  // Four-cell AA architecture: separated from the pneumatic bay by the retaining frame.
  const power = new Group();
  mesh(power, roundedPlate(1.43, 2.83, 0.1, 0.13, 0.018), mat.graphite, -0.67, 0, -0.39);
  for (const x of [-1.29, -0.05]) mesh(power, plate(0.07, 2.8, 0.44, 0.02), mat.graphite, x, 0, -0.16);
  for (let index = 0; index < 4; index++) {
    const x = index % 2 ? -0.37 : -0.97, y = index < 2 ? -0.68 : 0.68;
    // Two-by-two AA cells lie along Y, with believable length/diameter and plated end caps.
    mesh(power, cylinder(0.195, 1.22), mat.battery, x, y, -0.15);
    mesh(power, cylinder(0.198, 0.29), index % 2 ? mat.darkMetal : mat.graphite, x, y + 0.4, -0.15);
    for (const direction of [-1, 1]) {
      mesh(power, cylinder(0.182, 0.025), mat.metal, x, y + direction * 0.62, -0.15);
      mesh(power, box(0.2, 0.022, 0.25), mat.copper, x, y + direction * 0.65, -0.15);
    }
    mesh(power, cylinder(0.064, 0.052), mat.metal, x, y + (index % 2 ? -0.645 : 0.645), -0.15);
  }
  tube(power, [[-0.05, 1.15, -0.22], [0.12, 1.36, -0.1], [0.28, 1.22, 0.24]], mat.orange, 0.019);
  tube(power, [[-0.06, 1.01, -0.25], [0.17, 1.2, -0.05], [0.34, 1.21, 0.24]], mat.rubber, 0.019);
  register('power-module', power, [-1.65, -0.28, -0.5], 0.16, 0.58, 0.075, [0, -0.035, 0]);

  // Miniature rolling pump: drawn steel motor can, end cap, diaphragm head and mounting cradle.
  const pump = new Group();
  mesh(pump, plate(0.88, 1.54, 0.11, 0.14), mat.rubber, 0.75, 0.55, -0.4);
  const motor = mesh(pump, cylinder(0.345, 0.86), mat.metal, 0.75, 0.7, -0.08);
  const motorBand = mesh(pump, cylinder(0.35, 0.15), mat.darkMetal, 0.75, 0.35, -0.08);
  // Cylinder axis Y is intentional for the horizontal motor.
  void motor; void motorBand;
  mesh(pump, cylinder(0.28, 0.14), mat.graphite, 0.75, 1.19, -0.08);
  mesh(pump, cylinder(0.37, 0.3), mat.interior, 0.75, 0.12, -0.08);
  mesh(pump, cylinder(0.23, 0.08), mat.graphite, 0.75, -0.06, -0.08);
  const nozzle = mesh(pump, cylinder(0.073, 0.27, 0.088), mat.interior, 0.75, -0.235, -0.01);
  void nozzle;
  for (const y of [0.47, 0.95]) {
    const clamp = mesh(pump, new TorusGeometry(0.352, 0.025, 8, 32), mat.graphite, 0.75, y, -0.08);
    clamp.rotation.x = Math.PI / 2;
  }
  for (const x of [0.4, 1.1]) {
    mesh(pump, plate(0.12, 0.35, 0.18, 0.025), mat.interior, x, 0.1, -0.31);
    disc(pump, 0.055, 0.035, mat.metal, x, 0.1, -0.2);
  }
  for (const x of [0.62, 0.88]) mesh(pump, box(0.07, 0.045, 0.16), mat.copper, x, 1.29, -0.02);
  tube(pump, [[0.62, 1.29, 0.03], [0.5, 1.44, 0.09], [0.38, 1.36, 0.27]], mat.rubber, 0.016);
  tube(pump, [[0.88, 1.29, 0.03], [0.78, 1.46, 0.13], [0.46, 1.35, 0.27]], mat.orange, 0.016);
  register('air-pump', pump, [1.55, 0.12, -0.32], 0.1, 0.49, 0.065, [0, 0.035, -0.04]);

  // Solenoid release valve, manifold, pneumatic barbs and a cuff inlet at the right flank.
  const valves = new Group();
  mesh(valves, plate(0.87, 0.86, 0.08, 0.1), mat.interior, 0.78, -1.0, -0.36);
  mesh(valves, plate(0.48, 0.6, 0.42, 0.07), mat.graphite, 0.65, -0.94, -0.1);
  const coil = mesh(valves, cylinder(0.18, 0.55), mat.darkMetal, 0.65, -0.94, -0.04);
  coil.rotation.z = Math.PI / 2;
  mesh(valves, plate(0.48, 0.28, 0.24, 0.05), mat.interior, 1.1, -0.94, -0.04);
  for (const y of [-0.82, -1.06]) {
    const barb = mesh(valves, cylinder(0.069, 0.27, 0.085), mat.interior, 1.38, y, -0.02);
    barb.rotation.z = Math.PI / 2;
    const ridge = mesh(valves, cylinder(0.085, 0.035), mat.interior, 1.47, y, -0.02);
    ridge.rotation.z = Math.PI / 2;
  }
  disc(valves, 0.055, 0.04, mat.metal, 0.66, -1.12, 0.14);
  for (const x of [0.47, 0.83]) mesh(valves, box(0.045, 0.04, 0.12), mat.copper, x, -0.66, 0.03);
  register('release-valve', valves, [1.75, -0.8, 0.05], 0.12, 0.53, 0.08, [0.015, 0, -0.035]);

  const pneumatic = new Group();
  tube(pneumatic, [[0.75, -0.35, -0.01], [0.95, -0.53, 0.04], [1.48, -0.55, 0.03], [1.5, -0.82, -0.02]]);
  tube(pneumatic, [[1.5, -1.06, -0.02], [1.57, -1.31, 0.0], [1.49, -1.43, 0.11], [1.68, -1.43, 0.13]]);
  tube(pneumatic, [[1.42, -0.82, 0.0], [1.5, -0.28, 0.05], [1.5, 0.71, 0.18], [1.43, 1.03, 0.62], [0.94, 0.92, 0.64]]);
  const port = mesh(pneumatic, cylinder(0.14, 0.19, 0.15), mat.graphite, 1.75, -1.43, 0.13);
  port.rotation.z = Math.PI / 2;
  const portInner = mesh(pneumatic, cylinder(0.075, 0.2), mat.metal, 1.77, -1.43, 0.13);
  portInner.rotation.z = Math.PI / 2;
  const portVoid = mesh(pneumatic, cached('port-hole', () => new CircleGeometry(0.058, 24)), mat.rubber, 1.878, -1.43, 0.13);
  portVoid.rotation.y = Math.PI / 2;
  register('pneumatic-circuit', pneumatic, [1.45, -0.15, 0.35], 0.14, 0.55, 0.095);

  // Controller board with real mounting holes, rasterized fine traces and distinct packages.
  const board = new Group();
  mesh(board, roundedPlate(2.92, 3.12, 0.073, 0.18, 0.008, [
    ...[-1.32, 1.32].flatMap(x => [-1.38, 1.38].map(y => ({ x, y, width: 0.115, height: 0.115, radius: 0.0575 }))),
  ]), mat.pcb, 0, 0, 0.35);
  const traceTexture = makeBoardTexture();
  const traceMaterial = new MeshStandardMaterial({ map: traceTexture, roughness: 0.54, metalness: 0.2, transparent: true, depthWrite: false });
  mesh(board, cached('board-traces', () => new PlaneGeometry(2.88, 3.08)), traceMaterial, 0, 0, 0.39);
  for (const x of [-1.32, 1.32]) for (const y of [-1.38, 1.38]) {
    mesh(board, cached('board-mount-ring', () => new RingGeometry(0.06, 0.106, 24)), mat.copper, x, y, 0.391);
  }
  mesh(board, plate(0.66, 0.69, 0.09, 0.025, 0.008), mat.chip, -0.37, 0.1, 0.438);
  mesh(board, plate(0.3, 0.46, 0.08, 0.018), mat.chip, 0.6, 0.28, 0.434);
  mesh(board, plate(0.36, 0.22, 0.09, 0.018), mat.chip, -0.73, -0.96, 0.439);
  mesh(board, plate(0.44, 0.18, 0.105, 0.025), mat.metal, -0.82, 0.98, 0.445);
  disc(board, 0.072, 0.22, mat.darkMetal, 0.57, -0.85, 0.5);
  disc(board, 0.069, 0.224, mat.metal, 0.57, -0.85, 0.502);
  disc(board, 0.093, 0.27, mat.graphite, 0.91, -0.58, 0.52);
  disc(board, 0.091, 0.015, mat.metal, 0.91, -0.58, 0.662);
  // Batch the fine leads of the main QFP; each lead has a plated contact beneath it.
  const leadGeometry = box(0.027, 0.12, 0.025);
  const leads: Matrix4[] = [];
  const dummy = new Object3D();
  for (let side = 0; side < 4; side++) {
    for (let pin = 0; pin < 9; pin++) {
      const d = (pin - 4) * 0.065;
      dummy.position.set(-0.37 + (side % 2 ? (side === 1 ? 0.39 : -0.39) : d), 0.1 + (side % 2 ? d : (side === 0 ? -0.405 : 0.405)), 0.412);
      dummy.rotation.z = side % 2 ? Math.PI / 2 : 0;
      dummy.updateMatrix(); leads.push(dummy.matrix.clone());
    }
  }
  addInstances(board, leadGeometry, mat.metal, leads);
  const resistors: Matrix4[] = [], terminals: Matrix4[] = [];
  for (let index = 0; index < 29; index++) {
    const side = index % 3;
    const x = side === 0 ? -1.09 : side === 1 ? 0.65 : -0.7 + (index % 5) * 0.32;
    const y = side === 0 ? -0.88 + Math.floor(index / 3) * 0.21 : side === 1 ? 0.62 + Math.floor(index / 3) * 0.073 : -0.92 + Math.floor(index / 15) * 0.29;
    dummy.position.set(x, y, 0.426); dummy.rotation.set(0, 0, side === 1 ? Math.PI / 2 : 0); dummy.updateMatrix();
    resistors.push(dummy.matrix.clone());
    for (const shift of [-0.067, 0.067]) {
      dummy.position.set(x + (side === 1 ? 0 : shift), y + (side === 1 ? shift : 0), 0.418); dummy.updateMatrix();
      terminals.push(dummy.matrix.clone());
    }
  }
  addInstances(board, box(0.105, 0.054, 0.04), mat.ceramic, resistors);
  addInstances(board, box(0.035, 0.06, 0.026), mat.metal, terminals);
  for (const [x, y] of [[-0.1, 1.28], [0.95, 1.25], [0.2, -1.29]]) {
    mesh(board, plate(0.38, 0.17, 0.14, 0.02), mat.interior, x, y, 0.465);
    for (let pin = 0; pin < 4; pin++) mesh(board, box(0.035, 0.12, 0.04), mat.copper, x - 0.12 + pin * 0.08, y, 0.554);
  }
  register('main-pcb', board, [0, 0.05, 0.61], 0.27, 0.73, 0.11, [0.015, -0.015, 0]);

  // Separate pressure transducer: daughterboard, ceramic package, port and solder legs.
  const sensor = new Group();
  mesh(sensor, plate(0.55, 0.57, 0.048, 0.045), mat.pcb, 0.94, 0.92, 0.42);
  mesh(sensor, plate(0.32, 0.34, 0.12, 0.045), mat.interior, 0.94, 0.92, 0.5);
  disc(sensor, 0.065, 0.1, mat.interior, 0.94, 0.92, 0.609);
  disc(sensor, 0.082, 0.025, mat.interior, 0.94, 0.92, 0.64);
  disc(sensor, 0.036, 0.005, mat.graphite, 0.94, 0.92, 0.663);
  for (const x of [0.72, 1.16]) for (let index = 0; index < 3; index++) mesh(sensor, box(0.08, 0.035, 0.045), mat.metal, x, 0.8 + index * 0.12, 0.458);
  register('pressure-sensor', sensor, [1.6, 0.46, 1.0], 0.31, 0.72, 0.14, [0, 0.03, -0.04]);

  // LCD includes its rigid backing, bezel and a visibly separate amber flex tail.
  const display = new Group();
  mesh(display, plate(2.58, 2.26, 0.095, 0.16, 0.02), mat.metal, 0, 0.43, 0.72);
  const bezel = mesh(display, roundedPlate(2.56, 2.24, 0.07, 0.15, 0.02, [
    { x: 0, y: 0, width: 2.31, height: 1.98, radius: 0.085 },
  ]), mat.graphite, 0, 0.43, 0.873);
  bezel.rotation.x = FACE_TILT;
  const lcdTexture = makeLcdTexture();
  const lcdMaterial = new MeshStandardMaterial({ map: lcdTexture, roughness: 0.6, metalness: 0, emissive: '#74816c', emissiveMap: lcdTexture, emissiveIntensity: 0.16 });
  const screen = mesh(display, cached('lcd-face', () => new PlaneGeometry(2.31, 1.98)), lcdMaterial, 0, 0.43, 0.914);
  screen.rotation.x = FACE_TILT;
  // Backing components follow the same top plane angle.
  const flex = mesh(display, plate(0.52, 0.82, 0.012, 0.015, 0.003), mat.copper, 0.45, -0.95, 0.686);
  flex.rotation.x = -0.32;
  for (let index = 0; index < 7; index++) {
    const trace = mesh(display, box(0.022, 0.78, 0.004), mat.darkMetal, 0.28 + index * 0.056, -0.95, 0.696);
    trace.rotation.x = -0.32;
  }
  register('lcd-module', display, [-0.19, -0.07, 1.57], 0.41, 0.85, 0.155, [0.012, -0.018, 0]);

  // Tactile switches and caps move as three separate actuators, plus their supporting board.
  const controls = new Group();
  mesh(controls, plate(2.36, 0.59, 0.055, 0.1), mat.pcb, 0, -1.25, 0.59);
  for (const x of [-0.86, 0, 0.86]) {
    mesh(controls, plate(0.27, 0.27, 0.09, 0.025), mat.metal, x, -1.25, 0.661);
    disc(controls, 0.08, 0.08, mat.graphite, x, -1.25, 0.733);
  }
  register('control-pcb', controls, [0.12, -0.55, 1.15], 0.39, 0.81, 0.17);
  for (let index = 0; index < 3; index++) {
    const button = new Group();
    const x = index === 0 ? 0 : index === 1 ? -0.86 : 0.86;
    const radius = index === 0 ? 0.313 : 0.165;
    disc(button, radius, 0.11, index === 0 ? mat.orange : mat.graphite, x, -1.25, 0.848, radius * 1.03);
    disc(button, radius * 0.79, 0.027, index === 0 ? mat.orange : mat.graphite, x, -1.25, 0.914);
    const marking = makeTextTexture(index === 0 ? 'START / STOP' : index === 1 ? 'M' : 'SET', '#f4f0e8', 256, 64, index === 0 ? 22 : 36);
    const label = mesh(button, new PlaneGeometry(index === 0 ? 0.46 : 0.2, index === 0 ? 0.115 : 0.1), new MeshBasicMaterial({ map: marking, transparent: true, depthWrite: false }), x, -1.25, 0.935);
    label.rotation.x = FACE_TILT;
    register(index === 0 ? 'start-stop-button' : index === 1 ? 'memory-button' : 'settings-button', button,
      [index === 0 ? 0.28 : x * 0.18, -0.83, 1.8 + index * 0.11], 0.46 + index * 0.015, 0.87 + index * 0.015, 0.18 + index * 0.012);
  }

  // Upper moulding: open display aperture, individual button holes, internal clips and skirt.
  const upper = new Group();
  const apertures = [
    { x: 0, y: 0.43, width: 2.61, height: 2.29, radius: 0.16 },
    { x: 0, y: -1.25, width: 0.654, height: 0.654, radius: 0.327 },
    { x: -0.86, y: -1.25, width: 0.36, height: 0.36, radius: 0.18 },
    { x: 0.86, y: -1.25, width: 0.36, height: 0.36, radius: 0.18 },
  ];
  mesh(upper, slopeGeometry(roundedPlate(3.45, 3.75, 0.13, 0.46, 0.047, apertures), SLOPE), mat.housing, 0, 0, 0.845);
  mesh(upper, slopeGeometry(roundedPlate(3.45, 3.75, 0.72, 0.46, 0.019, [
    { x: 0, y: 0, width: 3.17, height: 3.47, radius: 0.34 },
  ]), SLOPE, -0.36, 0.72), mat.housing, 0, 0, 0.42);
  for (const x of [-1.48, 1.48]) {
    for (const y of [-0.92, 0.95]) {
      mesh(upper, plate(0.14, 0.25, 0.1, 0.025), mat.interior, x, y, 0.38 + SLOPE * y);
    }
  }
  // A restrained identification line printed into the shell, not a product logo.
  const idTexture = makeTextTexture('UPPER ARM  /  DIGITAL MONITOR', '#64706b', 1024, 96, 32);
  const identification = mesh(upper, new PlaneGeometry(1.56, 0.146), new MeshBasicMaterial({ map: idTexture, transparent: true, depthWrite: false }), 0, 1.72, 1.092);
  identification.rotation.x = FACE_TILT;
  register('upper-housing', upper, [-0.55, 0.31, 3.12], 0.66, 1, 0.2, [0.018, -0.025, 0]);

  const lens = new Group();
  const lensBorder = mesh(lens, roundedPlate(2.64, 2.32, 0.027, 0.17, 0.015, [
    { x: 0, y: 0, width: 2.45, height: 2.13, radius: 0.105 },
  ]), mat.graphite, 0, 0.43, 0.96);
  lensBorder.rotation.x = FACE_TILT;
  const glass = mesh(lens, roundedPlate(2.46, 2.14, 0.018, 0.11, 0.01), mat.lens, 0, 0.43, 0.974);
  glass.rotation.x = FACE_TILT;
  glass.renderOrder = 2;
  register('display-cover', lens, [-0.32, 0.04, 2.36], 0.52, 0.92, 0.18, [0.018, -0.015, 0]);

  // Four independently manifested fasteners; all translate along their installation axes.
  for (let index = 0; index < 4; index++) {
    const x = index % 2 ? 1.32 : -1.32, y = index < 2 ? 1.38 : -1.38;
    const screw = new Group();
    const z = 0.414;
    disc(screw, 0.046, 0.32, mat.darkMetal, x, y, z - 0.16);
    mesh(screw, cached('fastener-thread', () => curvedTube(Array.from({ length: 73 }, (_, step): [number, number, number] => {
      const angle = step / 72 * Math.PI * 10;
      return [Math.cos(angle) * 0.046, Math.sin(angle) * 0.046, -0.14 + step / 72 * 0.27];
    }), 0.007)), mat.metal, x, y, z - 0.16);
    disc(screw, 0.086, 0.042, mat.metal, x, y, z + 0.01, 0.073);
    for (const angle of [0, Math.PI / 2]) {
      const slot = mesh(screw, box(0.09, 0.018, 0.006), mat.graphite, x, y, z + 0.034);
      slot.rotation.z = angle;
    }
    // Board screws seat while the outer shell is still open; the upper housing closes last.
    register(`fastener-${index + 1}`, screw, [0, 0, index < 2 ? 3.62 : 2.9], 0.49 + index * 0.018, 0.75 + index * 0.018, 0.23 + index * 0.012);
  }
  return { root, parts };
}

function addInstances(parent: Group, geometry: BufferGeometry, material: Material, transforms: readonly Matrix4[]): void {
  const instances = new InstancedMesh(geometry, material, transforms.length);
  transforms.forEach((matrix, index) => instances.setMatrixAt(index, matrix));
  instances.instanceMatrix.needsUpdate = true;
  instances.castShadow = true; instances.receiveShadow = true;
  parent.add(instances);
}

function canvasTexture(width: number, height: number, paint: (context: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Product surface textures require a 2D canvas context.');
  paint(context);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeTextTexture(text: string, color: string, width: number, height: number, size: number): CanvasTexture {
  return canvasTexture(width, height, context => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = color;
    context.font = `500 ${size}px Arial, sans-serif`;
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(text, width / 2, height / 2);
  });
}

function makeLcdTexture(): CanvasTexture {
  return canvasTexture(768, 660, context => {
    context.fillStyle = '#b8c1b1'; context.fillRect(0, 0, 768, 660);
    context.fillStyle = '#263b35';
    context.textBaseline = 'middle';
    context.font = '500 23px Arial, sans-serif'; context.fillText('SYS', 45, 94); context.fillText('mmHg', 47, 127);
    context.fillText('DIA', 45, 315); context.fillText('mmHg', 47, 348);
    context.fillText('PULSE', 49, 547); context.fillText('/ min', 49, 580);
    drawSevenSegment(context, '120', 229, 36, 97, 168);
    drawSevenSegment(context, '80', 343, 257, 97, 168);
    drawSevenSegment(context, '72', 461, 507, 58, 100);
    context.strokeStyle = 'rgba(38,59,53,.2)'; context.lineWidth = 2;
    context.beginPath(); context.moveTo(40, 469); context.lineTo(727, 469); context.stroke();
    context.lineWidth = 3; context.strokeStyle = '#34473e';
    context.strokeRect(667, 38, 47, 20); context.fillStyle = '#34473e'; context.fillRect(715, 43, 5, 10);
    for (let index = 0; index < 3; index++) context.fillRect(672 + index * 13, 43, 9, 10);
    // Small, quiet pulse-wave mark, kept out of the numerical hierarchy.
    context.beginPath(); context.moveTo(242, 556); context.lineTo(282, 556); context.lineTo(293, 538);
    context.lineTo(304, 576); context.lineTo(319, 541); context.lineTo(331, 556); context.lineTo(363, 556); context.stroke();
    for (let index = 0; index < 6; index++) {
      context.fillStyle = `rgba(38,59,53,${0.28 + index * 0.085})`;
      context.fillRect(43, 194 + index * 23, 10, 16);
    }
  });
}

function drawSevenSegment(context: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, height: number): void {
  const segments: Record<string, string> = { '0': 'ab cdef'.replace(' ', ''), '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg' };
  const t = width * 0.12, inset = t * 0.2, half = height / 2;
  const horizontal = (px: number, py: number) => {
    context.beginPath(); context.moveTo(px + t, py); context.lineTo(px + width - t, py);
    context.lineTo(px + width - t / 2, py + t / 2); context.lineTo(px + width - t, py + t);
    context.lineTo(px + t, py + t); context.lineTo(px + t / 2, py + t / 2); context.closePath(); context.fill();
  };
  const vertical = (px: number, py: number) => {
    context.beginPath(); context.moveTo(px, py + t); context.lineTo(px + t / 2, py + t / 2);
    context.lineTo(px + t, py + t); context.lineTo(px + t, py + half - t);
    context.lineTo(px + t / 2, py + half - t / 2); context.lineTo(px, py + half - t); context.closePath(); context.fill();
  };
  for (const [index, digit] of [...value].entries()) {
    const px = x + index * width * 1.16;
    for (const segment of 'abcdefg') {
      context.fillStyle = segments[digit].includes(segment) ? '#263b35' : 'rgba(38,59,53,.045)';
      if (segment === 'a') horizontal(px, y);
      if (segment === 'g') horizontal(px, y + half - t / 2);
      if (segment === 'd') horizontal(px, y + height - t);
      if (segment === 'f') vertical(px + inset, y);
      if (segment === 'b') vertical(px + width - t - inset, y);
      if (segment === 'e') vertical(px + inset, y + half);
      if (segment === 'c') vertical(px + width - t - inset, y + half);
    }
  }
}

function makeBoardTexture(): CanvasTexture {
  return canvasTexture(768, 820, context => {
    context.clearRect(0, 0, 768, 820);
    context.strokeStyle = '#739b72'; context.lineWidth = 2;
    for (let index = 0; index < 35; index++) {
      const startX = 55 + (index * 83) % 650, startY = 65 + (index * 47) % 685;
      const endX = 68 + (index * 131) % 630, endY = 90 + (index * 71) % 650;
      const bend = Math.min(Math.abs(endX - startX), Math.abs(endY - startY)) * 0.48;
      const dx = Math.sign(endX - startX), dy = Math.sign(endY - startY);
      context.globalAlpha = 0.3 + (index % 4) * 0.09;
      context.beginPath(); context.moveTo(startX, startY); context.lineTo(startX + dx * bend, startY);
      context.lineTo(startX + dx * bend * 2, startY + dy * bend); context.lineTo(endX, startY + dy * bend);
      context.lineTo(endX, endY); context.stroke();
      context.fillStyle = '#ba9a61'; context.beginPath(); context.arc(startX, startY, 3.5, 0, Math.PI * 2); context.fill();
    }
    context.globalAlpha = 0.75; context.fillStyle = '#cad8b9'; context.font = '15px monospace';
    context.fillText('CTRL  /  REV 01', 60, 743); context.fillText('6V  DC', 554, 715);
    for (let index = 0; index < 15; index++) context.fillText(`R${index + 1}`, 75 + (index * 91) % 570, 110 + (index * 109) % 560);
  });
}
