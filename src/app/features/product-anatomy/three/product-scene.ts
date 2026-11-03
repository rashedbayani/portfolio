import {
  ACESFilmicToneMapping,
  Box3,
  BufferGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Line,
  Material,
  Mesh,
  OrthographicCamera,
  PMREMGenerator,
  Points,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBloodPressureMonitor } from './blood-pressure-monitor.factory';
import type { ProductPart } from './product-parts';

export interface ProductSceneCallbacks {
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

interface PartBounds {
  group: Group;
  corners: readonly Vector3[];
}

/** Browser-only rendering and resource ownership; the experience owns its single animation loop. */
export class ProductScene {
  readonly parts: ProductPart[] = [];

  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  private readonly renderer: WebGLRenderer;
  private root = new Group();
  private resizeObserver?: ResizeObserver;
  private environment?: WebGLRenderTarget;
  private readonly partBounds: PartBounds[] = [];
  private readonly projectedCorner = new Vector3();
  private aspect = 1;
  private separation = 0;
  private mobile = false;
  private disposed = false;
  private contextLost = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: ProductSceneCallbacks = {},
  ) {
    this.renderer = new WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
      stencil: false,
      depth: true,
    });
    try {
      this.renderer.outputColorSpace = SRGBColorSpace;
      this.renderer.toneMapping = ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.setClearColor(0x16120f, 0);
      this.renderer.shadowMap.enabled = false;

      const canvas = this.renderer.domElement;
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
      canvas.addEventListener('webglcontextlost', this.onContextLost);
      canvas.addEventListener('webglcontextrestored', this.onContextRestored);

      const model = createBloodPressureMonitor();
      this.root = model.root;
      this.parts = model.parts;
      this.scene.add(this.root);

      this.environment = this.createEnvironment();
      this.scene.environment = this.environment.texture;
      this.scene.environmentIntensity = 0.5;

      // Broad neutral illumination preserves the enclosure's warm polymer and the small electronics.
      this.scene.add(new HemisphereLight(0xf6f3eb, 0x41362d, 0.75));
      this.addLight(0xfff7ed, 3.2, -5, -6, 9);
      this.addLight(0xe8eff5, 1.15, 6, -2, 4);
      this.addLight(0xffffff, 2.1, 1, 6, 7);

      this.camera.up.set(0, 0, 1);
      this.camera.position.set(5, -7, 8).normalize().multiplyScalar(24);
      this.camera.lookAt(0, 0, 0);
      this.camera.updateMatrixWorld(true);
      this.cachePartBounds();
      container.appendChild(canvas);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
      this.resize();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  render(): void {
    if (this.disposed || this.contextLost || document.hidden) return;
    this.renderer.render(this.scene, this.camera);
  }

  /** Call after the authoritative animation updates transforms; there is no separate camera clock. */
  setSeparation(value: number): void {
    if (this.disposed) return;
    this.separation = Math.min(1, Math.max(0, value));
    this.fitCamera();
  }

  resize(): void {
    if (this.disposed) return;
    const { width, height } = this.container.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    this.mobile = window.matchMedia('(max-width: 767px)').matches;
    this.aspect = width / height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 1.75));
    this.renderer.setSize(width, height, false);
    this.fitCamera();
    this.render();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver?.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);

    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    const textures = new Set<Texture>();
    this.root.traverse(object => {
      if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        // Includes canvas labels and future procedural maps without coupling disposal to the factory.
        for (const value of Object.values(material)) {
          if (value instanceof Texture) textures.add(value);
        }
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    this.scene.environment = null;
    this.environment?.dispose();
    this.scene.clear();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }

  private addLight(color: number, intensity: number, x: number, y: number, z: number): void {
    const light = new DirectionalLight(color, intensity);
    light.position.set(x, y, z);
    this.scene.add(light);
  }

  private createEnvironment(): WebGLRenderTarget {
    const room = new RoomEnvironment();
    const pmrem = new PMREMGenerator(this.renderer);
    try {
      return pmrem.fromScene(room, 0.04, 0.1, 100);
    } finally {
      room.dispose();
      pmrem.dispose();
    }
  }

  /** Geometry is measured once; only these eight local corners per part are transformed per frame. */
  private cachePartBounds(): void {
    this.root.updateMatrixWorld(true);
    for (const part of this.parts) {
      const bounds = new Box3().setFromObject(part.group, true);
      if (bounds.isEmpty()) continue;
      const corners: Vector3[] = [];
      for (let index = 0; index < 8; index++) {
        const corner = new Vector3(
          index & 1 ? bounds.max.x : bounds.min.x,
          index & 2 ? bounds.max.y : bounds.min.y,
          index & 4 ? bounds.max.z : bounds.min.z,
        );
        corners.push(part.group.worldToLocal(corner));
      }
      this.partBounds.push({ group: part.group, corners });
    }
  }

  private fitCamera(): void {
    if (this.partBounds.length === 0) return;
    this.root.updateMatrixWorld(true);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    // Fit the actual camera-space part bounds. A world-space union projected afterward adds large
    // empty diagonal corners and makes the assembled product unnecessarily small.
    for (const part of this.partBounds) {
      for (const localCorner of part.corners) {
        this.projectedCorner.copy(localCorner)
          .applyMatrix4(part.group.matrixWorld)
          .applyMatrix4(this.camera.matrixWorldInverse);
        minX = Math.min(minX, this.projectedCorner.x);
        maxX = Math.max(maxX, this.projectedCorner.x);
        minY = Math.min(minY, this.projectedCorner.y);
        maxY = Math.max(maxY, this.projectedCorner.y);
      }
    }
    // Extra space in the open composition leaves room for hovering and preserves the engineered
    // negative space. At the seated endpoint the device remains a prominent product portrait.
    const padding = (this.mobile ? 1.12 : 1.14) + this.separation * 0.035;
    const halfHeight = Math.max((maxY - minY) / 2, (maxX - minX) / (2 * this.aspect)) * padding;
    const halfWidth = halfHeight * this.aspect;
    const xCenter = (minX + maxX) / 2;
    const yCenter = (minY + maxY) / 2;
    this.camera.left = xCenter - halfWidth;
    this.camera.right = xCenter + halfWidth;
    this.camera.top = yCenter + halfHeight;
    this.camera.bottom = yCenter - halfHeight;
    this.camera.updateProjectionMatrix();
  }

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.callbacks.onContextLost?.();
  };

  private readonly onContextRestored = (): void => {
    if (this.disposed) return;
    // Render-target contents do not survive context loss, unlike uploadable canvas textures.
    this.environment?.dispose();
    try {
      this.environment = this.createEnvironment();
      this.scene.environment = this.environment.texture;
    } catch {
      this.callbacks.onContextLost?.();
      return;
    }
    this.contextLost = false;
    this.resize();
    this.callbacks.onContextRestored?.();
  };
}
