import type { Mesh, Object3D } from 'three';

// A mesh that actually carries morph targets (three marks both fields optional).
export type MorphMesh = Mesh & {
  morphTargetDictionary: Record<string, number>;
  morphTargetInfluences: number[];
};

export interface MorphTargetRef {
  mesh: MorphMesh;
  index: number;
}

export interface MorphIndex {
  byName: Map<string, MorphTargetRef[]>;
  allNames: string[];
  arkit: string[];
}

const ARKIT_NAMES = new Set([
  'browDownLeft',
  'browDownRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
  'cheekPuff',
  'cheekSquintLeft',
  'cheekSquintRight',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeLookDownLeft',
  'eyeLookDownRight',
  'eyeLookInLeft',
  'eyeLookInRight',
  'eyeLookOutLeft',
  'eyeLookOutRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeSquintLeft',
  'eyeSquintRight',
  'eyeWideLeft',
  'eyeWideRight',
  'jawForward',
  'jawLeft',
  'jawOpen',
  'jawRight',
  'mouthClose',
  'mouthDimpleLeft',
  'mouthDimpleRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'mouthFunnel',
  'mouthLeft',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthPressLeft',
  'mouthPressRight',
  'mouthPucker',
  'mouthRight',
  'mouthRollLower',
  'mouthRollUpper',
  'mouthShrugLower',
  'mouthShrugUpper',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthStretchLeft',
  'mouthStretchRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'noseSneerLeft',
  'noseSneerRight',
  'tongueOut',
]);

const CUSTOM_MORPH_ALIASES: Record<string, string[]> = {
  'EYES CLOSE': ['eyeBlinkLeft', 'eyeBlinkRight'],
  mouth_right_up_smile: ['mouthSmileRight'],
  mouth_left_up_smile: ['mouthSmileLeft'],
  mouth_right_down: ['mouthFrownRight', 'mouthLowerDownRight'],
  mouth_left_down: ['mouthFrownLeft', 'mouthLowerDownLeft'],
  mouth_right_wide: ['mouthStretchRight'],
  mouth_left_wide: ['mouthStretchLeft'],
  mouth_right_squeeze: ['mouthPressRight'],
  mouth_left_squeeze: ['mouthPressLeft'],
  'mouth up': ['jawOpen', 'mouthShrugUpper'],
  lip: ['mouthPucker', 'mouthClose'],
  'top lip out': ['mouthFunnel', 'mouthUpperUpLeft', 'mouthUpperUpRight'],
  'mad right': ['browDownRight'],
  'mad left': ['browDownLeft'],
  'shy right': ['eyeSquintRight'],
  'shy left': ['eyeSquintLeft'],
  'oout right': ['eyeWideRight'],
  'out left': ['eyeWideLeft'],
};

function addMorphTarget(
  byName: Map<string, MorphTargetRef[]>,
  name: string,
  target: MorphTargetRef,
) {
  let list = byName.get(name);
  if (!list) {
    list = [];
    byName.set(name, list);
  }
  list.push(target);
}

function isMorphMesh(obj: Object3D): obj is MorphMesh {
  const mesh = obj as Mesh;
  return Boolean(mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences);
}

export function discoverMorphs(root: Object3D): MorphIndex {
  const byName = new Map<string, MorphTargetRef[]>();
  root.traverse((obj) => {
    if (!isMorphMesh(obj)) return;
    for (const [name, index] of Object.entries(obj.morphTargetDictionary)) {
      const target: MorphTargetRef = { mesh: obj, index };
      addMorphTarget(byName, name, target);
      for (const alias of CUSTOM_MORPH_ALIASES[name] || []) {
        addMorphTarget(byName, alias, target);
      }
    }
  });
  const allNames = [...byName.keys()].sort();
  const arkit = allNames.filter((n) => ARKIT_NAMES.has(n));
  return { byName, allNames, arkit };
}

export function setMorph(morphIndex: MorphIndex, name: string, value: number): void {
  const targets = morphIndex.byName.get(name);
  if (!targets) return;
  const v = Math.max(0, Math.min(1, value));
  for (const { mesh, index } of targets) {
    mesh.morphTargetInfluences[index] = v;
  }
}

export function getMorph(morphIndex: MorphIndex, name: string): number {
  const first = morphIndex.byName.get(name)?.[0];
  if (!first) return 0;
  return first.mesh.morphTargetInfluences[first.index] ?? 0;
}

export function resetMorphs(morphIndex: MorphIndex): void {
  for (const [, targets] of morphIndex.byName) {
    for (const { mesh, index } of targets) {
      mesh.morphTargetInfluences[index] = 0;
    }
  }
}

const REGION_PREFIXES: Array<[string, string[]]> = [
  ['Eyes', ['eyeBlink', 'eyeSquint', 'eyeWide', 'eyeLook']],
  ['Brows', ['brow']],
  ['Jaw', ['jaw']],
  ['Mouth', ['mouth']],
  ['Cheeks', ['cheek']],
  ['Nose', ['nose']],
  ['Tongue', ['tongue']],
];
export function groupByRegion(names: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>(REGION_PREFIXES.map(([k]) => [k, []]));
  groups.set('Other', []);
  for (const n of names) {
    let placed = false;
    for (const [region, prefixes] of REGION_PREFIXES) {
      if (prefixes.some((p) => n.toLowerCase().startsWith(p.toLowerCase()))) {
        groups.get(region)?.push(n);
        placed = true;
        break;
      }
    }
    if (!placed) groups.get('Other')?.push(n);
  }
  for (const [k, v] of groups) if (v.length === 0) groups.delete(k);
  return groups;
}
