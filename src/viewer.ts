import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { discoverMorphs } from './morphs';
import type { MorphIndex } from './morphs';
import { detectArmature } from './armature';
import type { Armature } from './armature';
import { createProcAnimations } from './procAnim';
import type { ProcAnimations } from './procAnim';
import { dlog } from './debug';

export interface Viewer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  avatar: THREE.Object3D | null;
  armature: Armature | null;
  mixer: THREE.AnimationMixer | null;
  animations: Map<string, THREE.AnimationAction>;
  procAnimations: ProcAnimations;
  morphIndex: MorphIndex;
  currentFileName: string | null;
  setIdleUpdate: (fn: ((dt: number) => void) | null) => void;
  frameHead: () => void;
  frameBody: () => void;
  loadGLB: (source: string | ArrayBuffer, fileName?: string | null) => Promise<void>;
  /** Stops the render loop and releases every GPU resource this viewer owns. */
  dispose: () => void;
  onModelLoaded: ((viewer: Viewer) => void) | null;
}

// One-time scene/renderer setup. Returns a viewer handle whose
// .loadGLB(source) loads a model from a URL string or an ArrayBuffer.
export function createViewer(
  canvas: HTMLCanvasElement,
  onStatus: (msg: string) => void = () => {},
): Viewer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2d33);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 1.2);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 3, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 20;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb0c4ff, 0.4);
  fill.position.set(-2, 1, -1);
  scene.add(fill);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 64),
    new THREE.ShadowMaterial({ opacity: 0.25 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 2000);
  camera.position.set(0, 1.55, 1.2);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1.5, 0);
  controls.minPolarAngle = Math.PI * 0.15;
  controls.maxPolarAngle = Math.PI * 0.7;

  const loader = new GLTFLoader();

  // --- Model state ---
  const viewer: Viewer = {
    scene,
    camera,
    renderer,
    controls,
    avatar: null,
    armature: null,
    mixer: null,
    animations: new Map(),
    procAnimations: { actions: new Map(), status: [] },
    morphIndex: { byName: new Map(), allNames: [], arkit: [] },
    currentFileName: null,
    setIdleUpdate(fn) {
      idleUpdate = fn;
    },
    frameHead,
    frameBody,
    loadGLB,
    dispose,
    onModelLoaded: null, // set by main.ts
  };

  let idleUpdate: ((dt: number) => void) | null = null;
  const headBoneWorld = new THREE.Vector3();
  const avatarBox = new THREE.Box3();
  const avatarSize = new THREE.Vector3();
  const avatarCenter = new THREE.Vector3();

  // ----- Animation loop runs even before first GLB loaded -----
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  const clock = new THREE.Clock();
  let rafId = 0;
  let disposed = false;
  function tick() {
    if (disposed) return;
    const dt = clock.getDelta();
    if (idleUpdate) idleUpdate(dt);
    if (viewer.mixer) viewer.mixer.update(dt);
    controls.update();
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  // ----- Full teardown (for consumers that mount/unmount the viewer) -----
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
    controls.dispose();
    disposeAvatar();
    ground.geometry.dispose();
    ground.material.dispose();
    renderer.dispose();
  }

  // ----- Disposal of previous avatar -----
  function disposeAvatar() {
    if (!viewer.avatar) return;
    if (viewer.mixer) {
      viewer.mixer.stopAllAction();
      viewer.mixer.uncacheRoot(viewer.avatar);
    }
    scene.remove(viewer.avatar);
    viewer.avatar.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          for (const k of Object.keys(m)) {
            const v = (m as unknown as Record<string, unknown>)[k];
            if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
          }
          m.dispose();
        }
      }
    });
    viewer.avatar = null;
    viewer.armature = null;
    viewer.mixer = null;
    viewer.animations = new Map();
    viewer.procAnimations = { actions: new Map(), status: [] };
    viewer.morphIndex = { byName: new Map(), allNames: [], arkit: [] };
  }

  // ----- Load a GLB from either a URL string or an ArrayBuffer -----
  async function loadGLB(source: string | ArrayBuffer, fileName: string | null = null) {
    onStatus('Loading GLB…');
    let gltf: GLTF;
    try {
      if (typeof source === 'string') {
        gltf = await new Promise<GLTF>((resolve, reject) => {
          loader.load(
            source,
            resolve,
            (xhr) => {
              if (xhr.lengthComputable) {
                const pct = Math.round((xhr.loaded / xhr.total) * 100);
                onStatus(`Loading GLB… ${pct}%`);
              }
            },
            reject,
          );
        });
      } else {
        gltf = await new Promise<GLTF>((resolve, reject) => {
          loader.parse(source, '', resolve, reject);
        });
      }
    } catch (err) {
      onStatus(`Failed to load GLB: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }

    disposeAvatar();

    const avatar = gltf.scene;
    avatar.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
      }
    });
    scene.add(avatar);
    avatar.updateMatrixWorld(true);

    // Normalize scale + position.
    const rawBox = new THREE.Box3().setFromObject(avatar);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    if (rawSize.y > 10) {
      const s = 1.7 / rawSize.y;
      avatar.scale.multiplyScalar(s);
      avatar.updateMatrixWorld(true);
    }
    avatarBox.setFromObject(avatar);
    avatarBox.getSize(avatarSize);
    const center = avatarBox.getCenter(new THREE.Vector3());
    avatar.position.x -= center.x;
    avatar.position.z -= center.z;
    avatar.position.y -= avatarBox.min.y;
    avatar.updateMatrixWorld(true);
    avatarBox.setFromObject(avatar);
    avatarBox.getSize(avatarSize);

    viewer.avatar = avatar;
    viewer.currentFileName = fileName;

    // Armature + morphs + animations.
    const armature = detectArmature(avatar);
    const mixer = new THREE.AnimationMixer(avatar);
    viewer.armature = armature;
    viewer.morphIndex = discoverMorphs(avatar);
    viewer.mixer = mixer;

    const animations = new Map<string, THREE.AnimationAction>();
    for (const clip of gltf.animations) {
      animations.set(clip.name, mixer.clipAction(clip));
    }
    viewer.animations = animations;

    viewer.procAnimations = createProcAnimations(armature, mixer);

    // Camera framing.
    const head = armature.resolved.head;
    if (head) {
      head.getWorldPosition(headBoneWorld);
    } else {
      headBoneWorld.set(0, avatarBox.max.y - avatarSize.y * 0.08, 0);
    }
    avatarBox.getCenter(avatarCenter);
    const dist = distanceToFitBox(avatarSize, 1.18);
    controls.target.copy(avatarCenter);
    camera.position.set(avatarCenter.x, avatarCenter.y, avatarCenter.z + dist);
    camera.near = Math.max(0.001, dist * 0.01);
    camera.far = Math.max(50, dist * 20);
    camera.updateProjectionMatrix();
    controls.minDistance = dist * 0.3;
    controls.maxDistance = dist * 6;
    controls.update();

    dlog('loaded', fileName || (typeof source === 'string' ? source : 'buffer'), {
      bones: armature.bones.size,
      rig: armature.rig,
      animations: [...viewer.animations.keys()],
      morphs: viewer.morphIndex.allNames.length,
    });

    if (typeof viewer.onModelLoaded === 'function') viewer.onModelLoaded(viewer);
  }

  function frameHead() {
    if (!viewer.armature?.resolved.head) return;
    viewer.armature.resolved.head.getWorldPosition(headBoneWorld);
    controls.target.copy(headBoneWorld);
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, 0.75);
  }
  function frameBody() {
    if (!viewer.avatar) return;
    avatarBox.setFromObject(viewer.avatar);
    avatarBox.getCenter(avatarCenter);
    avatarBox.getSize(avatarSize);
    controls.target.copy(avatarCenter);
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, distanceToFitBox(avatarSize, 1.18));
  }

  function distanceToFitBox(size: THREE.Vector3, margin = 1.15) {
    const fovRad = (camera.fov * Math.PI) / 180;
    const fitHeight = size.y / (2 * Math.tan(fovRad / 2));
    const fitWidth = size.x / (2 * Math.tan(fovRad / 2) * Math.max(0.1, camera.aspect));
    return Math.max(0.5, fitHeight, fitWidth, size.z * 1.5) * margin;
  }

  return viewer;
}
