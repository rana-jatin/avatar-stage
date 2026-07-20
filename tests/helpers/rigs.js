import * as THREE from 'three';

// Builds a parent->child bone chain from a list of names and returns the bones.
function chain(parent, names) {
  const out = [];
  let cur = parent;
  for (const name of names) {
    const b = new THREE.Bone();
    b.name = name;
    cur.add(b);
    out.push(b);
    cur = b;
  }
  return out;
}

// Per-family bone name tables. Each rig is a plausible humanoid hierarchy:
// hip -> spine chain -> head, with shoulder/arm/hand+fingers and leg branches.
const FAMILIES = {
  mixamo: {
    spineChain: [
      'mixamorigHips',
      'mixamorigSpine',
      'mixamorigSpine1',
      'mixamorigSpine2',
      'mixamorigNeck',
      'mixamorigHead',
    ],
    arm: (side) => [
      `mixamorig${side}Shoulder`,
      `mixamorig${side}Arm`,
      `mixamorig${side}ForeArm`,
      `mixamorig${side}Hand`,
    ],
    fingers: (side) => [
      `mixamorig${side}HandIndex1`,
      `mixamorig${side}HandMiddle1`,
      `mixamorig${side}HandRing1`,
      `mixamorig${side}HandPinky1`,
    ],
    leg: (side) => [`mixamorig${side}UpLeg`, `mixamorig${side}Leg`, `mixamorig${side}Foot`],
    sides: ['Left', 'Right'],
    spineAttach: { arm: 3, leg: 0 },
  },
  rpm: {
    spineChain: ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head'],
    arm: (side) => [`${side}Shoulder`, `${side}Arm`, `${side}ForeArm`, `${side}Hand`],
    fingers: (side) => [
      `${side}HandIndex1`,
      `${side}HandMiddle1`,
      `${side}HandRing1`,
      `${side}HandPinky1`,
    ],
    leg: (side) => [`${side}UpLeg`, `${side}Leg`, `${side}Foot`],
    sides: ['Left', 'Right'],
    spineAttach: { arm: 3, leg: 0 },
  },
  cc4: {
    spineChain: [
      'CC_Base_Hip',
      'CC_Base_Spine01',
      'CC_Base_Spine02',
      'CC_Base_NeckTwist01',
      'CC_Base_Head',
    ],
    arm: (side) => [
      `CC_Base_${side}_Clavicle`,
      `CC_Base_${side}_Upperarm`,
      `CC_Base_${side}_Forearm`,
      `CC_Base_${side}_Hand`,
    ],
    fingers: (side) => [
      `CC_Base_${side}_Index1`,
      `CC_Base_${side}_Mid1`,
      `CC_Base_${side}_Ring1`,
      `CC_Base_${side}_Pinky1`,
    ],
    leg: (side) => [`CC_Base_${side}_Thigh`, `CC_Base_${side}_Calf`, `CC_Base_${side}_Foot`],
    sides: ['L', 'R'],
    spineAttach: { arm: 2, leg: 0 },
  },
  vroid: {
    spineChain: [
      'J_Bip_C_Hips',
      'J_Bip_C_Spine',
      'J_Bip_C_Chest',
      'J_Bip_C_UpperChest',
      'J_Bip_C_Neck',
      'J_Bip_C_Head',
    ],
    arm: (side) => [
      `J_Bip_${side}_Shoulder`,
      `J_Bip_${side}_UpperArm`,
      `J_Bip_${side}_LowerArm`,
      `J_Bip_${side}_Hand`,
    ],
    fingers: (side) => [
      `J_Bip_${side}_Index1`,
      `J_Bip_${side}_Middle1`,
      `J_Bip_${side}_Ring1`,
      `J_Bip_${side}_Little1`,
    ],
    leg: (side) => [`J_Bip_${side}_UpperLeg`, `J_Bip_${side}_LowerLeg`, `J_Bip_${side}_Foot`],
    sides: ['L', 'R'],
    spineAttach: { arm: 3, leg: 0 },
  },
  rigify: {
    spineChain: ['DEF-hips', 'DEF-spine', 'DEF-spine.001', 'DEF-spine.002', 'DEF-neck', 'DEF-head'],
    arm: (side) => [
      `DEF-shoulder.${side}`,
      `DEF-upper_arm.${side}`,
      `DEF-forearm.${side}`,
      `DEF-hand.${side}`,
    ],
    fingers: (side) => [
      `DEF-f_index.01.${side}`,
      `DEF-f_middle.01.${side}`,
      `DEF-f_ring.01.${side}`,
      `DEF-f_pinky.01.${side}`,
    ],
    leg: (side) => [`DEF-thigh.${side}`, `DEF-shin.${side}`, `DEF-foot.${side}`],
    sides: ['L', 'R'],
    spineAttach: { arm: 3, leg: 0 },
  },
};

// Generic-family rig: full humanoid with fingers on both hands.
export function makeRig(family) {
  const def = FAMILIES[family];
  if (!def) throw new Error(`unknown rig family: ${family}`);
  const root = new THREE.Group();
  const spine = chain(root, def.spineChain);
  for (const side of def.sides) {
    const [, , , hand] = chain(spine[def.spineAttach.arm], def.arm(side));
    for (const fingerName of def.fingers(side)) {
      const [palm] = chain(hand, [fingerName]);
      chain(palm, [`${fingerName}_seg2`, `${fingerName}_seg3`]);
    }
    chain(spine[def.spineAttach.leg], def.leg(side));
  }
  return root;
}

// The bundled smurf-style rig: numbered bones + a literal `head`.
// Mirrors the shape SMURF_ROLE_MAP expects, including palm bones with
// two finger segments each so palm/finger clips generate tracks.
export function makeSmurfRig({ dotted = false } = {}) {
  const n = (num) =>
    dotted ? `Bone.${String(num).padStart(3, '0')}` : `Bone${String(num).padStart(3, '0')}`;
  const root = new THREE.Group();
  const [hip, spine2, head] = chain(root, [n(1), n(2), 'head']);

  const leftPalms = [7, 11, 15, 19];
  const rightPalms = [30, 34, 38, 42];

  const [, , , lHand] = chain(spine2, [n(3), n(4), n(5), n(6)]);
  for (const p of leftPalms) {
    const [palm] = chain(lHand, [n(p)]);
    chain(palm, [n(p + 1), n(p + 2)]);
  }
  const [, , , rHand] = chain(spine2, [n(48), n(27), n(28), n(29)]);
  for (const p of rightPalms) {
    const [palm] = chain(rHand, [n(p)]);
    chain(palm, [n(p + 1), n(p + 2)]);
  }

  chain(hip, [n(23), n(24), n(25)]);
  chain(hip, [n(50), n(45), n(46)]);
  void head;
  return root;
}

// A skeleton that matches no known naming scheme.
export function makeGarbageRig() {
  const root = new THREE.Group();
  chain(root, ['alpha', 'beta', 'gamma']);
  return root;
}

// A mesh with morph targets. `names` maps morph name -> initial influence.
export function makeMorphMesh(names) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  mesh.morphTargetDictionary = {};
  mesh.morphTargetInfluences = [];
  let i = 0;
  for (const [name, value] of Object.entries(names)) {
    mesh.morphTargetDictionary[name] = i;
    mesh.morphTargetInfluences[i] = value;
    i++;
  }
  return mesh;
}

// A deterministic fake requestAnimationFrame + performance.now clock.
// Callbacks queued via rAF run when `advance(ms)` moves the clock forward.
export function installFakeRaf(vi) {
  let now = 0;
  let queue = [];
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('requestAnimationFrame', (cb) => {
    queue.push(cb);
    return queue.length;
  });
  return {
    advance(ms) {
      now += ms;
      const q = queue;
      queue = [];
      for (const cb of q) cb(now);
    },
    get pending() {
      return queue.length;
    },
  };
}
