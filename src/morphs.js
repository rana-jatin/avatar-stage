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

const CUSTOM_MORPH_ALIASES = {
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

function addMorphTarget(byName, name, target) {
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(target);
}

export function discoverMorphs(root) {
  const byName = new Map();
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.morphTargetDictionary || !obj.morphTargetInfluences) return;
    for (const [name, index] of Object.entries(obj.morphTargetDictionary)) {
      const target = { mesh: obj, index };
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

export function setMorph(morphIndex, name, value) {
  const targets = morphIndex.byName.get(name);
  if (!targets) return;
  const v = Math.max(0, Math.min(1, value));
  for (const { mesh, index } of targets) {
    mesh.morphTargetInfluences[index] = v;
  }
}

export function getMorph(morphIndex, name) {
  const targets = morphIndex.byName.get(name);
  if (!targets || targets.length === 0) return 0;
  const { mesh, index } = targets[0];
  return mesh.morphTargetInfluences[index] ?? 0;
}

export function resetMorphs(morphIndex) {
  for (const [, targets] of morphIndex.byName) {
    for (const { mesh, index } of targets) {
      mesh.morphTargetInfluences[index] = 0;
    }
  }
}

const REGION_PREFIXES = [
  ['Eyes', ['eyeBlink', 'eyeSquint', 'eyeWide', 'eyeLook']],
  ['Brows', ['brow']],
  ['Jaw', ['jaw']],
  ['Mouth', ['mouth']],
  ['Cheeks', ['cheek']],
  ['Nose', ['nose']],
  ['Tongue', ['tongue']],
];
export function groupByRegion(names) {
  const groups = new Map(REGION_PREFIXES.map(([k]) => [k, []]));
  groups.set('Other', []);
  for (const n of names) {
    let placed = false;
    for (const [region, prefixes] of REGION_PREFIXES) {
      if (prefixes.some((p) => n.toLowerCase().startsWith(p.toLowerCase()))) {
        groups.get(region).push(n);
        placed = true;
        break;
      }
    }
    if (!placed) groups.get('Other').push(n);
  }
  for (const [k, v] of groups) if (v.length === 0) groups.delete(k);
  return groups;
}
