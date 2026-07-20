// Smurf armature resolver.
// The dashboard is dedicated to the smurf model (Smur_male6.glb), whose
// skeleton uses bones named `Bone` / `Bone.001`–`Bone.127` / `head`. This maps
// those bones onto the canonical humanoid roles the animation code expects.
// (GLTFLoader may strip the dot from bone names, so each role lists both the
// dotted and undotted spelling.)

const SMURF_ROLE_MAP = {
  hip: ['Bone001', 'Bone.001'],
  spine: ['Bone002', 'Bone.002'],
  chest: ['Bone002', 'Bone.002'],
  upperChest: ['Bone002', 'Bone.002'],
  neck: ['Bone002', 'Bone.002'],
  head: 'head',

  leftShoulder: ['Bone003', 'Bone.003'],
  leftUpperArm: ['Bone004', 'Bone.004'],
  leftLowerArm: ['Bone005', 'Bone.005'],
  leftHand: ['Bone006', 'Bone.006'],
  leftIndexPalm: ['Bone007', 'Bone.007'],
  leftMiddlePalm: ['Bone011', 'Bone.011'],
  leftRingPalm: ['Bone015', 'Bone.015'],
  leftPinkyPalm: ['Bone019', 'Bone.019'],
  rightShoulder: ['Bone048', 'Bone.048'],
  rightUpperArm: ['Bone027', 'Bone.027'],
  rightLowerArm: ['Bone028', 'Bone.028'],
  rightHand: ['Bone029', 'Bone.029'],
  rightIndexPalm: ['Bone030', 'Bone.030'],
  rightMiddlePalm: ['Bone034', 'Bone.034'],
  rightRingPalm: ['Bone038', 'Bone.038'],
  rightPinkyPalm: ['Bone042', 'Bone.042'],

  leftUpperLeg: ['Bone023', 'Bone.023'],
  leftLowerLeg: ['Bone024', 'Bone.024'],
  leftFoot: ['Bone025', 'Bone.025'],
  rightUpperLeg: ['Bone050', 'Bone.050'],
  rightLowerLeg: ['Bone045', 'Bone.045'],
  rightFoot: ['Bone046', 'Bone.046'],
};

export const ROLES = Object.keys(SMURF_ROLE_MAP);

function resolveBoneAlias(bones, aliases) {
  for (const name of [].concat(aliases)) {
    const bone = bones.get(name);
    if (bone) return bone;
  }
  const lowerAliases = new Set([].concat(aliases).map((name) => String(name).toLowerCase()));
  for (const [name, bone] of bones) {
    if (lowerAliases.has(name.toLowerCase())) return bone;
  }
  return null;
}

function collectBones(root) {
  const bones = new Map();
  let firstSkeletonRoot = null;
  root.traverse((o) => {
    if (o.isBone) {
      bones.set(o.name, o);
      if (!firstSkeletonRoot) firstSkeletonRoot = o;
    } else if (o.isSkinnedMesh && o.skeleton && !firstSkeletonRoot) {
      firstSkeletonRoot = o.skeleton.bones[0];
    }
  });
  return { bones, firstBone: firstSkeletonRoot };
}

function emptyResolved() {
  const out = {};
  for (const role of ROLES) out[role] = null;
  return out;
}

export function detectArmature(root) {
  const { bones, firstBone } = collectBones(root);
  const resolved = emptyResolved();

  if (!firstBone || bones.size === 0) {
    return {
      bones: new Map(), root: null, resolved, rig: 'smurf', hasSkeleton: false,
      setOverride() { return false; },
      getRole() { return null; },
    };
  }

  for (const [role, aliases] of Object.entries(SMURF_ROLE_MAP)) {
    const bone = resolveBoneAlias(bones, aliases);
    if (bone) resolved[role] = bone;
  }

  if (!resolved.head || !resolved.hip) {
    console.warn('[armature] expected smurf bones not found — animations may be incomplete', {
      head: !!resolved.head,
      hip: !!resolved.hip,
    });
  }

  return {
    bones,
    root: resolved.hip || firstBone,
    resolved,
    rig: 'smurf',
    hasSkeleton: true,

    // Manually remap a humanoid role onto a different bone of the smurf rig.
    // Pass '' / null to clear the role. Returns false for unknown roles or
    // bone names so the UI can keep the previous selection.
    setOverride(role, boneName) {
      if (!ROLES.includes(role)) return false;
      if (boneName === '' || boneName == null) {
        resolved[role] = null;
        return true;
      }
      const b = bones.get(boneName);
      if (!b) return false;
      resolved[role] = b;
      return true;
    },

    getRole(role) { return resolved[role] || null; },
  };
}
