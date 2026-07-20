// Runtime-generated AnimationClips that work on any uploaded armature.
// Each clip is built additively (relative to the rest pose) so it composes
// cleanly with the existing mixer and the idle behaviors.

import * as THREE from 'three';
import type { AnimationAction, AnimationMixer, Bone, KeyframeTrack, Object3D } from 'three';
import type { Armature, Role } from './armature';

const PI = Math.PI;
const D2R = PI / 250;

function isBone(o: Object3D | null | undefined): o is Bone {
  return Boolean(o && (o as Bone).isBone);
}

// Bones looked up by a computed role name (some combinations, like
// `leftThumbPalm`, intentionally have no canonical role and resolve to null).
function roleBone(arm: Armature, name: string): Bone | null {
  return (arm.resolved as Record<string, Bone | null | undefined>)[name] ?? null;
}

function quatTrack(bone: Bone, times: number[], eulerOffsets: number[][]): KeyframeTrack {
  const restQ = bone.quaternion.clone();
  const values = new Float32Array(times.length * 4);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < times.length; i++) {
    const [x = 0, y = 0, z = 0] = eulerOffsets[i] ?? [];
    e.set(x, y, z, 'XYZ');
    q.setFromEuler(e).multiply(restQ);
    values[i * 4 + 0] = q.x;
    values[i * 4 + 1] = q.y;
    values[i * 4 + 2] = q.z;
    values[i * 4 + 3] = q.w;
  }
  return new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values);
}

function localQuatTrack(bone: Bone, times: number[], eulerOffsets: number[][]): KeyframeTrack {
  const restQ = bone.quaternion.clone();
  const values = new Float32Array(times.length * 4);
  const q = new THREE.Quaternion();
  const offsetQ = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < times.length; i++) {
    const [x = 0, y = 0, z = 0] = eulerOffsets[i] ?? [];
    e.set(x, y, z, 'XYZ');
    q.copy(restQ).multiply(offsetQ.setFromEuler(e));
    values[i * 4 + 0] = q.x;
    values[i * 4 + 1] = q.y;
    values[i * 4 + 2] = q.z;
    values[i * 4 + 3] = q.w;
  }
  return new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values);
}

function posTrack(bone: Bone, times: number[], positionOffsets: number[][]): KeyframeTrack {
  const rest = bone.position.clone();
  const values = new Float32Array(times.length * 3);
  for (let i = 0; i < times.length; i++) {
    const [dx = 0, dy = 0, dz = 0] = positionOffsets[i] ?? [];
    values[i * 3 + 0] = rest.x + dx;
    values[i * 3 + 1] = rest.y + dy;
    values[i * 3 + 2] = rest.z + dz;
  }
  return new THREE.VectorKeyframeTrack(`${bone.name}.position`, times, values);
}

function pushQuat(
  tracks: KeyframeTrack[],
  used: Set<string>,
  bone: Bone | null | undefined,
  times: number[],
  eulerOffsets: number[][],
) {
  if (!bone) return;
  const key = `${bone.uuid}:quaternion`;
  if (used.has(key)) return;
  used.add(key);
  tracks.push(quatTrack(bone, times, eulerOffsets));
}

function pushLocalQuat(
  tracks: KeyframeTrack[],
  used: Set<string>,
  bone: Bone | null | undefined,
  times: number[],
  eulerOffsets: number[][],
) {
  if (!bone) return;
  const key = `${bone.uuid}:quaternion`;
  if (used.has(key)) return;
  used.add(key);
  tracks.push(localQuatTrack(bone, times, eulerOffsets));
}

function pushPos(
  tracks: KeyframeTrack[],
  used: Set<string>,
  bone: Bone | null | undefined,
  times: number[],
  positionOffsets: number[][],
) {
  if (!bone) return;
  const key = `${bone.uuid}:position`;
  if (used.has(key)) return;
  used.add(key);
  tracks.push(posTrack(bone, times, positionOffsets));
}

function degKeys(values: number[]): number[] {
  return values.map((v) => v * D2R);
}

interface PalmSpec {
  suffix: string;
  curl: number;
  spread: number;
}

const PALM_SPECS: PalmSpec[] = [
  { suffix: 'ThumbPalm', curl: 0.55, spread: -0.9 },
  { suffix: 'IndexPalm', curl: 0.8, spread: -0.35 },
  { suffix: 'MiddlePalm', curl: 1.0, spread: 0 },
  { suffix: 'RingPalm', curl: 0.95, spread: 0.35 },
  { suffix: 'PinkyPalm', curl: 0.85, spread: 0.7 },
];

const FINGER_SEGMENT_CURL = [0.72, 0.52, 0.36];

function boneDepth(bone: Bone): number {
  let d = 1;
  for (const c of bone.children || []) {
    if (isBone(c)) d = Math.max(d, 1 + boneDepth(c));
  }
  return d;
}

function fingerChildChain(root: Bone, maxSegments = FINGER_SEGMENT_CURL.length): Bone[] {
  const chain: Bone[] = [];
  let cur = root;
  for (let i = 0; i < maxSegments; i++) {
    const children = (cur.children || []).filter(isBone);
    const first = children[0];
    if (!first) break;
    let best = first;
    let bestDepth = boneDepth(best);
    for (let j = 1; j < children.length; j++) {
      const candidate = children[j];
      if (!candidate) continue;
      const d = boneDepth(candidate);
      if (d > bestDepth) {
        best = candidate;
        bestDepth = d;
      }
    }
    chain.push(best);
    cur = best;
  }
  return chain;
}

function sideFingerRoots(
  arm: Armature,
  side: 'left' | 'right',
): Array<{ bone: Bone; spec: PalmSpec }> {
  const roots: Array<{ bone: Bone; spec: PalmSpec }> = [];
  const seen = new Set<string>();
  for (const spec of PALM_SPECS) {
    const bone = roleBone(arm, `${side}${spec.suffix}`);
    if (!bone || seen.has(bone.uuid)) continue;
    roots.push({ bone, spec });
    seen.add(bone.uuid);
  }
  if (roots.length > 0) return roots;

  const hand = roleBone(arm, `${side}Hand`);
  if (!hand) return roots;

  const children = (hand.children || [])
    .filter((c): c is Bone => isBone(c) && !seen.has(c.uuid))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
    );
  const fallbackSpecs = children.length === 4 ? PALM_SPECS.slice(1) : PALM_SPECS;
  let specIndex = 0;

  for (const child of children) {
    while (
      specIndex < fallbackSpecs.length &&
      roots.some((r) => r.spec.suffix === fallbackSpecs[specIndex]?.suffix)
    ) {
      specIndex++;
    }
    const spec = fallbackSpecs[Math.min(specIndex, fallbackSpecs.length - 1)];
    if (spec) {
      roots.push({ bone: child, spec });
      seen.add(child.uuid);
    }
    specIndex++;
  }

  return roots;
}

function pushPalmShape(
  tracks: KeyframeTrack[],
  used: Set<string>,
  arm: Armature,
  side: 'left' | 'right',
  times: number[],
  curlKeys: number[],
  spreadKeys: number[] | null = null,
) {
  const sideSign = side === 'left' ? -1 : 1;
  for (const { bone, spec } of sideFingerRoots(arm, side)) {
    pushLocalQuat(
      tracks,
      used,
      bone,
      times,
      times.map((_, i) => {
        const curl = (curlKeys[i] ?? 0) * spec.curl;
        const spread = (spreadKeys?.[i] ?? 0) * spec.spread * sideSign;
        return [curl, 0, spread];
      }),
    );
    for (const [segmentIndex, child] of fingerChildChain(bone).entries()) {
      const segmentCurl =
        FINGER_SEGMENT_CURL[segmentIndex] ?? FINGER_SEGMENT_CURL[FINGER_SEGMENT_CURL.length - 1]!;
      pushLocalQuat(
        tracks,
        used,
        child,
        times,
        times.map((_, i) => {
          const curl = (curlKeys[i] ?? 0) * spec.curl * segmentCurl;
          return [curl, 0, 0];
        }),
      );
    }
  }
}

// Kaintha "point" pose: index finger stays extended (rest), all other fingers curl.
function pushPointPose(
  tracks: KeyframeTrack[],
  used: Set<string>,
  arm: Armature,
  side: 'left' | 'right',
  times: number[],
  otherCurlKeys: number[],
) {
  for (const { bone, spec } of sideFingerRoots(arm, side)) {
    if (spec.suffix === 'IndexPalm') continue; // leave index at rest (straight)
    pushLocalQuat(
      tracks,
      used,
      bone,
      times,
      times.map((_, i) => {
        const curl = (otherCurlKeys[i] ?? 0) * spec.curl;
        return [curl, 0, 0];
      }),
    );
    for (const [segmentIndex, child] of fingerChildChain(bone).entries()) {
      const segmentCurl =
        FINGER_SEGMENT_CURL[segmentIndex] ?? FINGER_SEGMENT_CURL[FINGER_SEGMENT_CURL.length - 1]!;
      pushLocalQuat(
        tracks,
        used,
        child,
        times,
        times.map((_, i) => {
          const curl = (otherCurlKeys[i] ?? 0) * spec.curl * segmentCurl;
          return [curl, 0, 0];
        }),
      );
    }
  }
}

// ---- Clip generators (each takes the resolved armature, returns AnimationClip|null) ----

function buildWave(arm: Armature): THREE.AnimationClip | null {
  const sh = arm.resolved.rightUpperArm;
  const fa = arm.resolved.rightLowerArm;
  const hand = arm.resolved.rightHand;
  if (!sh) return null;
  // Raise arm overhead, then wave the forearm side-to-side.
  const t = [0, 0.55, 1.1, 1.65, 2.2, 2.75, 3.3, 3.5];
  const upY = 30 * D2R;
  const upZ = 90 * D2R;
  const shoulder = [
    [0, 0, 0],
    [-22 * D2R, upY, upZ],
    [-30 * D2R, upY, upZ],
    [-36 * D2R, upY, upZ],
    [-32 * D2R, upY, upZ],
    [-24 * D2R, upY, upZ],
    [-16 * D2R, upY * 0.4, upZ * 0.4],
    [0, 0, 0],
  ];
  const tracks: KeyframeTrack[] = [];
  const used = new Set<string>();
  pushQuat(tracks, used, sh, t, shoulder);
  if (fa) {
    pushQuat(tracks, used, fa, t, [
      [0, 0, 0],
      [8 * D2R, 10 * D2R, -8 * D2R],
      [18 * D2R, 16 * D2R, -14 * D2R],
      [4 * D2R, 22 * D2R, -4 * D2R],
      [16 * D2R, 10 * D2R, -12 * D2R],
      [6 * D2R, 18 * D2R, -6 * D2R],
      [10 * D2R, 8 * D2R, -4 * D2R],
      [0, 0, 0],
    ]);
  }
  if (hand) {
    // add a small alternating Z twist so the palm rocks to-and-fro
    pushLocalQuat(tracks, used, hand, t, [
      [0, 0, 0],
      [-60 * D2R, 8 * D2R, 6 * D2R],
      [-65 * D2R, 4 * D2R, -10 * D2R],
      [-58 * D2R, 10 * D2R, 4 * D2R],
      [-66 * D2R, 6 * D2R, -12 * D2R],
      [-56 * D2R, 10 * D2R, 4 * D2R],
      [-48 * D2R, 6 * D2R, -2 * D2R],
      [0, 0, 0],
    ]);
  }
  pushPalmShape(
    tracks,
    used,
    arm,
    'right',
    t,
    degKeys([0, 5, 2, 6, 3, 5, 2, 0]),
    degKeys([0, 2, 1, 3, 2, 2, 1, 0]),
  );

  // Head turns toward the waving side and tilts up slightly while arm is raised.
  const head = arm.resolved.head;
  if (head) {
    pushQuat(tracks, used, head, t, [
      [0, 0, 0],
      [-5 * D2R, 12 * D2R, 0],
      [-5 * D2R, 14 * D2R, 0],
      [-3 * D2R, 12 * D2R, 0],
      [-4 * D2R, 13 * D2R, 0],
      [-3 * D2R, 10 * D2R, 0],
      [-1 * D2R, 5 * D2R, 0],
      [0, 0, 0],
    ]);
  }

  // Clavicle lifts as the arm rises overhead (trapezius shrug).
  const clav = arm.resolved.rightShoulder;
  if (clav) {
    pushQuat(tracks, used, clav, t, [
      [0, 0, 0],
      [8 * D2R, 0, -6 * D2R],
      [12 * D2R, 0, -8 * D2R],
      [15 * D2R, 0, -10 * D2R],
      [12 * D2R, 0, -8 * D2R],
      [9 * D2R, 0, -6 * D2R],
      [4 * D2R, 0, -2 * D2R],
      [0, 0, 0],
    ]);
  }

  // Spine leans slightly toward the raised arm to counterbalance its weight.
  const spine = arm.resolved.spine;
  if (spine) {
    pushQuat(tracks, used, spine, t, [
      [0, 0, 0],
      [0, 0, -3 * D2R],
      [0, 0, -4 * D2R],
      [0, 0, -5 * D2R],
      [0, 0, -4 * D2R],
      [0, 0, -3 * D2R],
      [0, 0, -1 * D2R],
      [0, 0, 0],
    ]);
  }

  // Opposite arm drops slightly as a natural balance response.
  const leftArm = arm.resolved.leftUpperArm;
  if (leftArm) {
    pushQuat(tracks, used, leftArm, t, [
      [0, 0, 0],
      [0, 0, 6 * D2R],
      [0, 0, 8 * D2R],
      [0, 0, 8 * D2R],
      [0, 0, 8 * D2R],
      [0, 0, 6 * D2R],
      [0, 0, 3 * D2R],
      [0, 0, 0],
    ]);
  }

  return new THREE.AnimationClip('Wave', 3.5, tracks);
}

function buildNod(arm: Armature): THREE.AnimationClip | null {
  const h = arm.resolved.head;
  if (!h) return null;
  const a = 10 * D2R;
  const t = [0, 0.3, 0.6, 0.9, 1.2, 1.5];
  const eul = [
    [0, 0, 0],
    [a, 0, 0],
    [-a * 0.3, 0, 0],
    [a, 0, 0],
    [-a * 0.3, 0, 0],
    [0, 0, 0],
  ];
  return new THREE.AnimationClip('Nod yes', 1.5, [quatTrack(h, t, eul)]);
}

function buildShake(arm: Armature): THREE.AnimationClip | null {
  const h = arm.resolved.head;
  if (!h) return null;
  const a = 15 * D2R;
  const t = [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8];
  const eul = [
    [0, 0, 0],
    [0, a, 0],
    [0, -a, 0],
    [0, a, 0],
    [0, -a, 0],
    [0, a * 0.4, 0],
    [0, 0, 0],
  ];
  return new THREE.AnimationClip('Shake no', 1.8, [quatTrack(h, t, eul)]);
}

function buildLookAround(arm: Armature): THREE.AnimationClip | null {
  const h = arm.resolved.head;
  if (!h) return null;
  const a = 22 * D2R;
  const p = 6 * D2R;
  const t = [0, 0.8, 1.6, 2.4, 3.2, 4.0];
  const eul = [
    [0, 0, 0],
    [-p, a, 0],
    [p, a, 0],
    [p, -a, 0],
    [-p, -a, 0],
    [0, 0, 0],
  ];
  return new THREE.AnimationClip('Look around', 4.0, [quatTrack(h, t, eul)]);
}

function buildShrug(arm: Armature): THREE.AnimationClip | null {
  const L = arm.resolved.leftShoulder || arm.resolved.leftUpperArm;
  const R = arm.resolved.rightShoulder || arm.resolved.rightUpperArm;
  if (!L && !R) return null;
  const t = [0, 0.4, 0.9, 1.3, 1.6];
  const up = 14 * D2R;
  const tracks: KeyframeTrack[] = [];
  if (L)
    tracks.push(
      quatTrack(L, t, [
        [0, 0, 0],
        [0, 0, -up],
        [0, 0, -up],
        [0, 0, -up * 0.3],
        [0, 0, 0],
      ]),
    );
  if (R)
    tracks.push(
      quatTrack(R, t, [
        [0, 0, 0],
        [0, 0, up],
        [0, 0, up],
        [0, 0, up * 0.3],
        [0, 0, 0],
      ]),
    );
  return new THREE.AnimationClip('Shrug', 1.6, tracks);
}

function buildBounce(arm: Armature): THREE.AnimationClip | null {
  const hip = arm.resolved.hip;
  if (!hip) return null;
  const t = [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8];
  // Hip height oscillation — small absolute amount; works in meters.
  const amp = 0.06;
  const ofs = [
    [0, 0, 0],
    [0, amp, 0],
    [0, 0, 0],
    [0, amp, 0],
    [0, 0, 0],
    [0, amp * 0.6, 0],
    [0, 0, 0],
  ];
  return new THREE.AnimationClip('Bounce', 1.8, [posTrack(hip, t, ofs)]);
}

function buildDance(arm: Armature): THREE.AnimationClip | null {
  const hip = arm.resolved.hip;
  const spine = arm.resolved.spine || arm.resolved.chest;
  const lUA = arm.resolved.leftUpperArm;
  const rUA = arm.resolved.rightUpperArm;
  const lHand = arm.resolved.leftHand;
  const rHand = arm.resolved.rightHand;
  if (!hip && !spine && !lUA && !rUA) return null;
  const t = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];
  const tracks: KeyframeTrack[] = [];
  const used = new Set<string>();
  if (hip) {
    const sway = 12 * D2R;
    tracks.push(
      quatTrack(hip, t, [
        [0, 0, 0],
        [0, 0, sway],
        [0, 0, -sway],
        [0, 0, sway],
        [0, 0, -sway],
        [0, 0, sway],
        [0, 0, -sway],
        [0, 0, sway],
        [0, 0, 0],
      ]),
    );
  }
  if (spine) {
    const a = 8 * D2R;
    tracks.push(
      quatTrack(spine, t, [
        [0, 0, 0],
        [0, a, -a * 0.8],
        [0, -a, a * 0.8],
        [0, a, -a * 0.8],
        [0, -a, a * 0.8],
        [0, a, -a * 0.8],
        [0, -a, a * 0.8],
        [0, a, -a * 0.8],
        [0, 0, 0],
      ]),
    );
  }
  if (lUA) {
    const z = -70 * D2R;
    tracks.push(
      quatTrack(lUA, t, [
        [0, 0, 0],
        [0, 0, z * 0.6],
        [0, 0, z],
        [0, 0, z * 0.6],
        [0, 0, z],
        [0, 0, z * 0.6],
        [0, 0, z],
        [0, 0, z * 0.6],
        [0, 0, 0],
      ]),
    );
  }
  if (rUA) {
    const z = 70 * D2R;
    tracks.push(
      quatTrack(rUA, t, [
        [0, 0, 0],
        [0, 0, z],
        [0, 0, z * 0.6],
        [0, 0, z],
        [0, 0, z * 0.6],
        [0, 0, z],
        [0, 0, z * 0.6],
        [0, 0, z],
        [0, 0, 0],
      ]),
    );
  }
  pushQuat(tracks, used, lHand, t, [
    [0, 0, 0],
    [0, 0, -8 * D2R],
    [0, 0, -14 * D2R],
    [0, 0, -8 * D2R],
    [0, 0, -14 * D2R],
    [0, 0, -8 * D2R],
    [0, 0, -14 * D2R],
    [0, 0, -8 * D2R],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rHand, t, [
    [0, 0, 0],
    [0, 0, 14 * D2R],
    [0, 0, 8 * D2R],
    [0, 0, 14 * D2R],
    [0, 0, 8 * D2R],
    [0, 0, 14 * D2R],
    [0, 0, 8 * D2R],
    [0, 0, 14 * D2R],
    [0, 0, 0],
  ]);
  pushPalmShape(
    tracks,
    used,
    arm,
    'left',
    t,
    degKeys([0, 5, 9, 5, 10, 5, 9, 5, 0]),
    degKeys([0, 2, 4, 2, 4, 2, 4, 2, 0]),
  );
  pushPalmShape(
    tracks,
    used,
    arm,
    'right',
    t,
    degKeys([0, 9, 5, 10, 5, 9, 5, 10, 0]),
    degKeys([0, 4, 2, 4, 2, 4, 2, 4, 0]),
  );

  // Forearm elbow bend — closes when upper arm is raised, opens as it drops.
  const lLA = arm.resolved.leftLowerArm;
  const rLA = arm.resolved.rightLowerArm;
  const eb = 35 * D2R;
  pushQuat(tracks, used, lLA, t, [
    [0, 0, 0],
    [eb * 0.5, 0, 0],
    [eb, 0, 0],
    [eb * 0.5, 0, 0],
    [eb, 0, 0],
    [eb * 0.5, 0, 0],
    [eb, 0, 0],
    [eb * 0.5, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rLA, t, [
    [0, 0, 0],
    [eb, 0, 0],
    [eb * 0.5, 0, 0],
    [eb, 0, 0],
    [eb * 0.5, 0, 0],
    [eb, 0, 0],
    [eb * 0.5, 0, 0],
    [eb, 0, 0],
    [0, 0, 0],
  ]);

  // Hip vertical bounce — the groove foundation, dips on every downbeat.
  if (hip) {
    const bounce = 0.04;
    pushPos(tracks, used, hip, t, [
      [0, 0, 0],
      [0, -bounce, 0],
      [0, -bounce * 0.3, 0],
      [0, -bounce, 0],
      [0, -bounce * 0.3, 0],
      [0, -bounce, 0],
      [0, -bounce * 0.3, 0],
      [0, -bounce, 0],
      [0, 0, 0],
    ]);
  }

  // Upper chest follows spine one keyframe behind — wave propagation through torso.
  const upperChest = arm.resolved.upperChest;
  if (upperChest) {
    const c = 5 * D2R;
    pushQuat(tracks, used, upperChest, t, [
      [0, 0, 0],
      [0, 0, 0],
      [0, c, -c * 0.6],
      [0, -c, c * 0.6],
      [0, c, -c * 0.6],
      [0, -c, c * 0.6],
      [0, c, -c * 0.6],
      [0, -c, c * 0.6],
      [0, 0, 0],
    ]);
  }

  // Head nods forward on each downbeat in sync with the rhythm.
  const dHead = arm.resolved.head;
  if (dHead) {
    const nod = 6 * D2R;
    pushQuat(tracks, used, dHead, t, [
      [0, 0, 0],
      [nod, 0, 0],
      [nod * 0.4, 0, 0],
      [nod, 0, 0],
      [nod * 0.4, 0, 0],
      [nod, 0, 0],
      [nod * 0.4, 0, 0],
      [nod, 0, 0],
      [0, 0, 0],
    ]);
  }

  // Clavicles lift when their arm is at peak swing, drop when arm is low.
  const lSh = arm.resolved.leftShoulder;
  const rSh = arm.resolved.rightShoulder;
  const cv = 10 * D2R;
  pushQuat(tracks, used, lSh, t, [
    [0, 0, 0],
    [cv * 0.4, 0, 0],
    [cv, 0, 0],
    [cv * 0.4, 0, 0],
    [cv, 0, 0],
    [cv * 0.4, 0, 0],
    [cv, 0, 0],
    [cv * 0.4, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rSh, t, [
    [0, 0, 0],
    [cv, 0, 0],
    [cv * 0.4, 0, 0],
    [cv, 0, 0],
    [cv * 0.4, 0, 0],
    [cv, 0, 0],
    [cv * 0.4, 0, 0],
    [cv, 0, 0],
    [0, 0, 0],
  ]);

  // Alternating leg weight-shift — left and right legs respond to hip sway direction.
  const lUL = arm.resolved.leftUpperLeg;
  const rUL = arm.resolved.rightUpperLeg;
  const ls = 8 * D2R;
  pushQuat(tracks, used, lUL, t, [
    [0, 0, 0],
    [-ls * 0.5, 0, 0],
    [ls * 0.5, 0, 0],
    [-ls * 0.5, 0, 0],
    [ls * 0.5, 0, 0],
    [-ls * 0.5, 0, 0],
    [ls * 0.5, 0, 0],
    [-ls * 0.5, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rUL, t, [
    [0, 0, 0],
    [ls * 0.5, 0, 0],
    [-ls * 0.5, 0, 0],
    [ls * 0.5, 0, 0],
    [-ls * 0.5, 0, 0],
    [ls * 0.5, 0, 0],
    [-ls * 0.5, 0, 0],
    [ls * 0.5, 0, 0],
    [0, 0, 0],
  ]);

  return new THREE.AnimationClip('Dance', 4.0, tracks);
}

function buildIdleVariation(arm: Armature): THREE.AnimationClip | null {
  const h = arm.resolved.head;
  const s = arm.resolved.spine;
  const lUA = arm.resolved.leftUpperArm;
  const rUA = arm.resolved.rightUpperArm;
  const lLA = arm.resolved.leftLowerArm;
  const rLA = arm.resolved.rightLowerArm;
  const lHand = arm.resolved.leftHand;
  const rHand = arm.resolved.rightHand;
  if (!h && !s && !lUA && !rUA) return null;
  const t = [0, 1.2, 2.4, 3.6, 4.8, 6.0];
  const tracks: KeyframeTrack[] = [];
  const used = new Set<string>();
  if (h) {
    const y = 5 * D2R;
    const x = 3 * D2R;
    pushQuat(tracks, used, h, t, [
      [0, 0, 0],
      [x, y, 0],
      [-x * 0.5, -y, 0],
      [x, y * 0.5, 0],
      [-x, -y * 0.5, 0],
      [0, 0, 0],
    ]);
  }
  if (s) {
    const a = 2 * D2R;
    pushQuat(tracks, used, s, t, [
      [0, 0, 0],
      [0, a, 0],
      [0, -a, 0],
      [0, a * 0.5, 0],
      [0, -a * 0.5, 0],
      [0, 0, 0],
    ]);
  }
  const aPose = 30 * D2R;
  const leftZ = aPose;
  const rightZ = -leftZ;
  pushQuat(tracks, used, lUA, t, [
    [0, 0, leftZ],
    [0, 0, leftZ],
    [0, 0, leftZ - 2 * D2R],
    [0, 0, leftZ],
    [0, 0, leftZ + 2 * D2R],
    [0, 0, leftZ],
  ]);
  pushQuat(tracks, used, rUA, t, [
    [0, 0, rightZ],
    [0, 0, rightZ],
    [0, 0, rightZ + 2 * D2R],
    [0, 0, rightZ],
    [0, 0, rightZ - 2 * D2R],
    [0, 0, rightZ],
  ]);
  pushQuat(tracks, used, lLA, t, [
    [0, 8 * D2R, 0],
    [0, 8 * D2R, 0],
    [0, 10 * D2R, 0],
    [0, 8 * D2R, 0],
    [0, 6 * D2R, 0],
    [0, 8 * D2R, 0],
  ]);
  pushQuat(tracks, used, rLA, t, [
    [0, -8 * D2R, 0],
    [0, -8 * D2R, 0],
    [0, -10 * D2R, 0],
    [0, -8 * D2R, 0],
    [0, -6 * D2R, 0],
    [0, -8 * D2R, 0],
  ]);
  pushQuat(tracks, used, lHand, t, [
    [0, 0, -4 * D2R],
    [0, 0, -4 * D2R],
    [0, 0, -3 * D2R],
    [0, 0, -4 * D2R],
    [0, 0, -5 * D2R],
    [0, 0, -4 * D2R],
  ]);
  pushQuat(tracks, used, rHand, t, [
    [0, 0, 4 * D2R],
    [0, 0, 4 * D2R],
    [0, 0, 3 * D2R],
    [0, 0, 4 * D2R],
    [0, 0, 5 * D2R],
    [0, 0, 4 * D2R],
  ]);
  pushPalmShape(
    tracks,
    used,
    arm,
    'left',
    t,
    degKeys([7, 7, 8, 7, 6, 7]),
    degKeys([1, 1, 2, 1, 1, 1]),
  );
  pushPalmShape(
    tracks,
    used,
    arm,
    'right',
    t,
    degKeys([7, 7, 8, 7, 6, 7]),
    degKeys([1, 1, 2, 1, 1, 1]),
  );
  return new THREE.AnimationClip('Idle variation', 6.0, tracks);
}

function buildHeroEntrance(arm: Armature): THREE.AnimationClip | null {
  const hip = arm.resolved.hip;
  const spine = arm.resolved.spine || arm.resolved.chest;
  const head = arm.resolved.head;
  const lUA = arm.resolved.leftUpperArm;
  const rUA = arm.resolved.rightUpperArm;
  const lLA = arm.resolved.leftLowerArm;
  const rLA = arm.resolved.rightLowerArm;
  const lHand = arm.resolved.leftHand;
  const rHand = arm.resolved.rightHand;
  const lUL = arm.resolved.leftUpperLeg;
  const rUL = arm.resolved.rightUpperLeg;
  const lLL = arm.resolved.leftLowerLeg;
  const rLL = arm.resolved.rightLowerLeg;
  if (!hip && !spine && !head && !lUA && !rUA) return null;

  const t = [0, 0.28, 0.55, 0.82, 1.1, 1.45, 1.85, 2.25, 2.6];
  const tracks: KeyframeTrack[] = [];
  const used = new Set<string>();

  pushPos(tracks, used, hip, t, [
    [0, 0, 0],
    [0, -0.08, 0],
    [0, 0.24, 0],
    [0, 0.06, 0],
    [0, 0, 0],
    [0, 0.03, 0],
    [0, 0.01, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, hip, t, [
    [0, 0, 0],
    [0, 0, 0],
    [0, 8 * D2R, 0],
    [0, -6 * D2R, 0],
    [0, 0, 0],
    [0, 0, 5 * D2R],
    [0, 0, -4 * D2R],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, spine, t, [
    [0, 0, 0],
    [12 * D2R, 0, 0],
    [-9 * D2R, 0, 0],
    [2 * D2R, 0, 0],
    [0, 0, 0],
    [0, 8 * D2R, 0],
    [0, -6 * D2R, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, head, t, [
    [0, 0, 0],
    [10 * D2R, 0, 0],
    [-8 * D2R, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [-4 * D2R, 12 * D2R, 0],
    [3 * D2R, -10 * D2R, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lUA, t, [
    [0, 0, 0],
    [0, 0, -20 * D2R],
    [0, 0, -120 * D2R],
    [0, 0, -92 * D2R],
    [0, 0, -55 * D2R],
    [0, 0, -35 * D2R],
    [0, 0, -18 * D2R],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rUA, t, [
    [0, 0, 0],
    [0, 0, 20 * D2R],
    [0, 0, 120 * D2R],
    [0, 0, 92 * D2R],
    [0, 0, 55 * D2R],
    [0, 0, 35 * D2R],
    [0, 0, 18 * D2R],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lLA, t, [
    [0, 0, 0],
    [0, 0, 0],
    [0, 24 * D2R, 0],
    [0, -18 * D2R, 0],
    [0, 0, 0],
    [0, 10 * D2R, 0],
    [0, -8 * D2R, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rLA, t, [
    [0, 0, 0],
    [0, 0, 0],
    [0, -24 * D2R, 0],
    [0, 18 * D2R, 0],
    [0, 0, 0],
    [0, -10 * D2R, 0],
    [0, 8 * D2R, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lHand, t, [
    [0, 0, 0],
    [0, 0, -4 * D2R],
    [0, 0, -12 * D2R],
    [0, 0, -8 * D2R],
    [0, 0, -5 * D2R],
    [0, 0, -4 * D2R],
    [0, 0, -2 * D2R],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rHand, t, [
    [0, 0, 0],
    [0, 0, 4 * D2R],
    [0, 0, 12 * D2R],
    [0, 0, 8 * D2R],
    [0, 0, 5 * D2R],
    [0, 0, 4 * D2R],
    [0, 0, 2 * D2R],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushPalmShape(
    tracks,
    used,
    arm,
    'left',
    t,
    degKeys([0, 3, 7, 6, 4, 3, 2, 0, 0]),
    degKeys([0, 2, 8, 6, 4, 3, 2, 0, 0]),
  );
  pushPalmShape(
    tracks,
    used,
    arm,
    'right',
    t,
    degKeys([0, 3, 7, 6, 4, 3, 2, 0, 0]),
    degKeys([0, 2, 8, 6, 4, 3, 2, 0, 0]),
  );
  pushQuat(tracks, used, lUL, t, [
    [0, 0, 0],
    [18 * D2R, 0, 0],
    [-8 * D2R, 0, 0],
    [2 * D2R, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rUL, t, [
    [0, 0, 0],
    [18 * D2R, 0, 0],
    [-8 * D2R, 0, 0],
    [2 * D2R, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lLL, t, [
    [0, 0, 0],
    [-20 * D2R, 0, 0],
    [10 * D2R, 0, 0],
    [-4 * D2R, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rLL, t, [
    [0, 0, 0],
    [-20 * D2R, 0, 0],
    [10 * D2R, 0, 0],
    [-4 * D2R, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);

  return new THREE.AnimationClip('Hero entrance', 2.6, tracks);
}

function buildClap(arm: Armature): THREE.AnimationClip | null {
  const spine = arm.resolved.spine || arm.resolved.chest;
  const head = arm.resolved.head;
  const lUA = arm.resolved.leftUpperArm;
  const rUA = arm.resolved.rightUpperArm;
  const lLA = arm.resolved.leftLowerArm;
  const rLA = arm.resolved.rightLowerArm;
  const lHand = arm.resolved.leftHand;
  const rHand = arm.resolved.rightHand;
  if (!lUA && !rUA && !lLA && !rLA) return null;

  const t = [0, 0.22, 0.42, 0.62, 0.82, 1.02, 1.24, 1.52, 1.85];
  const tracks: KeyframeTrack[] = [];
  const used = new Set<string>();

  pushQuat(tracks, used, spine, t, [
    [0, 0, 0],
    [-3 * D2R, 0, 0],
    [-5 * D2R, 0, 0],
    [0, 0, 0],
    [-5 * D2R, 0, 0],
    [0, 0, 0],
    [-3 * D2R, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, head, t, [
    [0, 0, 0],
    [-3 * D2R, 0, 0],
    [-6 * D2R, 0, 0],
    [4 * D2R, 0, 0],
    [-6 * D2R, 0, 0],
    [4 * D2R, 0, 0],
    [-3 * D2R, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lUA, t, [
    [0, 0, 0],
    [0, 0, -45 * D2R],
    [0, 18 * D2R, -72 * D2R],
    [0, -6 * D2R, -48 * D2R],
    [0, 18 * D2R, -72 * D2R],
    [0, -6 * D2R, -48 * D2R],
    [0, 10 * D2R, -62 * D2R],
    [0, 0, -25 * D2R],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rUA, t, [
    [0, 0, 0],
    [0, 0, 45 * D2R],
    [0, -18 * D2R, 72 * D2R],
    [0, 6 * D2R, 48 * D2R],
    [0, -18 * D2R, 72 * D2R],
    [0, 6 * D2R, 48 * D2R],
    [0, -10 * D2R, 62 * D2R],
    [0, 0, 25 * D2R],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lLA, t, [
    [0, 0, 0],
    [0, 0, 0],
    [0, 32 * D2R, 0],
    [0, 5 * D2R, 0],
    [0, 32 * D2R, 0],
    [0, 5 * D2R, 0],
    [0, 20 * D2R, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rLA, t, [
    [0, 0, 0],
    [0, 0, 0],
    [0, -32 * D2R, 0],
    [0, -5 * D2R, 0],
    [0, -32 * D2R, 0],
    [0, -5 * D2R, 0],
    [0, -20 * D2R, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lHand, t, [
    [0, 0, 0],
    [0, 0, -8 * D2R],
    [0, 0, -16 * D2R],
    [0, 0, -7 * D2R],
    [0, 0, -16 * D2R],
    [0, 0, -7 * D2R],
    [0, 0, -12 * D2R],
    [0, 0, -4 * D2R],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rHand, t, [
    [0, 0, 0],
    [0, 0, 8 * D2R],
    [0, 0, 16 * D2R],
    [0, 0, 7 * D2R],
    [0, 0, 16 * D2R],
    [0, 0, 7 * D2R],
    [0, 0, 12 * D2R],
    [0, 0, 4 * D2R],
    [0, 0, 0],
  ]);
  pushPalmShape(
    tracks,
    used,
    arm,
    'left',
    t,
    degKeys([0, 4, 2, 6, 2, 6, 4, 1, 0]),
    degKeys([0, 3, 1, 4, 1, 4, 3, 1, 0]),
  );
  pushPalmShape(
    tracks,
    used,
    arm,
    'right',
    t,
    degKeys([0, 4, 2, 6, 2, 6, 4, 1, 0]),
    degKeys([0, 3, 1, 4, 1, 4, 3, 1, 0]),
  );

  return new THREE.AnimationClip('Double clap', 1.85, tracks);
}

function buildPunchCombo(arm: Armature): THREE.AnimationClip | null {
  const hip = arm.resolved.hip;
  const spine = arm.resolved.spine || arm.resolved.chest;
  const head = arm.resolved.head;
  const lUA = arm.resolved.leftUpperArm;
  const rUA = arm.resolved.rightUpperArm;
  const lLA = arm.resolved.leftLowerArm;
  const rLA = arm.resolved.rightLowerArm;
  const lHand = arm.resolved.leftHand;
  const rHand = arm.resolved.rightHand;
  if (!lUA && !rUA && !spine) return null;

  const t = [0, 0.18, 0.35, 0.55, 0.72, 0.95, 1.18, 1.42, 1.68, 1.95, 2.25];
  const tracks: KeyframeTrack[] = [];
  const used = new Set<string>();

  pushPos(tracks, used, hip, t, [
    [0, 0, 0],
    [0, 0.02, 0],
    [0, 0, 0],
    [0, 0.02, 0],
    [0, 0, 0],
    [0, 0.03, 0],
    [0, 0.01, 0],
    [0, 0.03, 0],
    [0, 0, 0],
    [0, 0.01, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, hip, t, [
    [0, 0, 0],
    [0, -8 * D2R, 0],
    [0, 0, 0],
    [0, 9 * D2R, 0],
    [0, 0, 0],
    [0, -12 * D2R, 0],
    [0, 0, 0],
    [0, 11 * D2R, 0],
    [0, -8 * D2R, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, spine, t, [
    [0, 0, 0],
    [0, -14 * D2R, 0],
    [0, -2 * D2R, 0],
    [0, 14 * D2R, 0],
    [0, 1 * D2R, 0],
    [-3 * D2R, -18 * D2R, 0],
    [0, 0, 0],
    [-3 * D2R, 17 * D2R, 0],
    [0, -8 * D2R, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, head, t, [
    [0, 0, 0],
    [0, 7 * D2R, 0],
    [0, 0, 0],
    [0, -7 * D2R, 0],
    [0, 0, 0],
    [-3 * D2R, 10 * D2R, 0],
    [3 * D2R, 0, 0],
    [-3 * D2R, -10 * D2R, 0],
    [0, 6 * D2R, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lUA, t, [
    [0, 0, 0],
    [0, 0, -36 * D2R],
    [0, 0, -10 * D2R],
    [0, 0, -76 * D2R],
    [0, 0, -18 * D2R],
    [0, 0, -38 * D2R],
    [0, 0, -8 * D2R],
    [0, 0, -90 * D2R],
    [0, 0, -25 * D2R],
    [0, 0, -8 * D2R],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rUA, t, [
    [0, 0, 0],
    [0, 0, 78 * D2R],
    [0, 0, 16 * D2R],
    [0, 0, 34 * D2R],
    [0, 0, 8 * D2R],
    [0, 0, 95 * D2R],
    [0, 0, 20 * D2R],
    [0, 0, 42 * D2R],
    [0, 0, 82 * D2R],
    [0, 0, 12 * D2R],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lLA, t, [
    [0, 0, 0],
    [0, 18 * D2R, 0],
    [0, 0, 0],
    [0, 36 * D2R, 0],
    [0, 0, 0],
    [0, 14 * D2R, 0],
    [0, 0, 0],
    [0, 42 * D2R, 0],
    [0, 12 * D2R, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rLA, t, [
    [0, 0, 0],
    [0, -40 * D2R, 0],
    [0, -5 * D2R, 0],
    [0, -16 * D2R, 0],
    [0, 0, 0],
    [0, -48 * D2R, 0],
    [0, -6 * D2R, 0],
    [0, -16 * D2R, 0],
    [0, -34 * D2R, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lHand, t, [
    [0, 0, 0],
    [0, 0, -10 * D2R],
    [0, 0, -5 * D2R],
    [0, 0, -14 * D2R],
    [0, 0, -6 * D2R],
    [0, 0, -8 * D2R],
    [0, 0, -4 * D2R],
    [0, 0, -16 * D2R],
    [0, 0, -8 * D2R],
    [0, 0, -3 * D2R],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rHand, t, [
    [0, 0, 0],
    [0, 0, 16 * D2R],
    [0, 0, 7 * D2R],
    [0, 0, 8 * D2R],
    [0, 0, 3 * D2R],
    [0, 0, 18 * D2R],
    [0, 0, 8 * D2R],
    [0, 0, 9 * D2R],
    [0, 0, 15 * D2R],
    [0, 0, 4 * D2R],
    [0, 0, 0],
  ]);
  pushPalmShape(tracks, used, arm, 'left', t, degKeys([0, 20, 12, 25, 14, 18, 12, 28, 18, 8, 0]));
  pushPalmShape(tracks, used, arm, 'right', t, degKeys([0, 28, 16, 18, 10, 30, 17, 20, 27, 12, 0]));

  return new THREE.AnimationClip('Punch combo', 2.25, tracks);
}

function buildJumpTwist(arm: Armature): THREE.AnimationClip | null {
  const hip = arm.resolved.hip;
  const spine = arm.resolved.spine || arm.resolved.chest;
  const head = arm.resolved.head;
  const lUA = arm.resolved.leftUpperArm;
  const rUA = arm.resolved.rightUpperArm;
  const lHand = arm.resolved.leftHand;
  const rHand = arm.resolved.rightHand;
  const lUL = arm.resolved.leftUpperLeg;
  const rUL = arm.resolved.rightUpperLeg;
  const lLL = arm.resolved.leftLowerLeg;
  const rLL = arm.resolved.rightLowerLeg;
  if (!hip && !spine) return null;

  const t = [0, 0.22, 0.48, 0.72, 0.98, 1.2, 1.42, 1.7, 2.05];
  const tracks: KeyframeTrack[] = [];
  const used = new Set<string>();

  pushPos(tracks, used, hip, t, [
    [0, 0, 0],
    [0, -0.1, 0],
    [0, 0.28, 0],
    [0, 0.42, 0],
    [0, 0.24, 0],
    [0, 0.02, 0],
    [0, -0.02, 0],
    [0, 0.02, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, hip, t, [
    [0, 0, 0],
    [0, 0, 0],
    [0, 55 * D2R, 0],
    [0, 135 * D2R, 0],
    [0, 80 * D2R, 0],
    [0, 10 * D2R, 0],
    [0, -8 * D2R, 0],
    [0, 4 * D2R, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, spine, t, [
    [0, 0, 0],
    [12 * D2R, 0, 0],
    [-8 * D2R, 0, 0],
    [-6 * D2R, 0, 0],
    [2 * D2R, 0, 0],
    [6 * D2R, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, head, t, [
    [0, 0, 0],
    [8 * D2R, 0, 0],
    [-5 * D2R, -10 * D2R, 0],
    [-4 * D2R, 8 * D2R, 0],
    [2 * D2R, 0, 0],
    [5 * D2R, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lUA, t, [
    [0, 0, 0],
    [0, 0, -20 * D2R],
    [0, 0, -85 * D2R],
    [0, 0, -122 * D2R],
    [0, 0, -88 * D2R],
    [0, 0, -35 * D2R],
    [0, 0, -12 * D2R],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rUA, t, [
    [0, 0, 0],
    [0, 0, 20 * D2R],
    [0, 0, 85 * D2R],
    [0, 0, 122 * D2R],
    [0, 0, 88 * D2R],
    [0, 0, 35 * D2R],
    [0, 0, 12 * D2R],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lHand, t, [
    [0, 0, 0],
    [0, 0, -6 * D2R],
    [0, 0, -14 * D2R],
    [0, 0, -20 * D2R],
    [0, 0, -14 * D2R],
    [0, 0, -7 * D2R],
    [0, 0, -3 * D2R],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rHand, t, [
    [0, 0, 0],
    [0, 0, 6 * D2R],
    [0, 0, 14 * D2R],
    [0, 0, 20 * D2R],
    [0, 0, 14 * D2R],
    [0, 0, 7 * D2R],
    [0, 0, 3 * D2R],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushPalmShape(
    tracks,
    used,
    arm,
    'left',
    t,
    degKeys([0, 5, 10, 16, 12, 7, 3, 0, 0]),
    degKeys([0, 2, 4, 5, 4, 2, 1, 0, 0]),
  );
  pushPalmShape(
    tracks,
    used,
    arm,
    'right',
    t,
    degKeys([0, 5, 10, 16, 12, 7, 3, 0, 0]),
    degKeys([0, 2, 4, 5, 4, 2, 1, 0, 0]),
  );
  pushQuat(tracks, used, lUL, t, [
    [0, 0, 0],
    [20 * D2R, 0, 0],
    [-12 * D2R, 0, 0],
    [-16 * D2R, 0, 0],
    [-6 * D2R, 0, 0],
    [16 * D2R, 0, 0],
    [4 * D2R, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rUL, t, [
    [0, 0, 0],
    [20 * D2R, 0, 0],
    [-12 * D2R, 0, 0],
    [-16 * D2R, 0, 0],
    [-6 * D2R, 0, 0],
    [16 * D2R, 0, 0],
    [4 * D2R, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lLL, t, [
    [0, 0, 0],
    [-26 * D2R, 0, 0],
    [16 * D2R, 0, 0],
    [18 * D2R, 0, 0],
    [8 * D2R, 0, 0],
    [-18 * D2R, 0, 0],
    [-6 * D2R, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rLL, t, [
    [0, 0, 0],
    [-26 * D2R, 0, 0],
    [16 * D2R, 0, 0],
    [18 * D2R, 0, 0],
    [8 * D2R, 0, 0],
    [-18 * D2R, 0, 0],
    [-6 * D2R, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);

  return new THREE.AnimationClip('Jump twist', 2.05, tracks);
}

function buildBhangraDance(arm: Armature): THREE.AnimationClip | null {
  const hip = arm.resolved.hip;
  const spine = arm.resolved.spine || arm.resolved.chest;
  const head = arm.resolved.head;
  const lUA = arm.resolved.leftUpperArm;
  const rUA = arm.resolved.rightUpperArm;
  const lSh = arm.resolved.leftShoulder;
  const rSh = arm.resolved.rightShoulder;
  const lUL = arm.resolved.leftUpperLeg;
  const rUL = arm.resolved.rightUpperLeg;
  const lLL = arm.resolved.leftLowerLeg;
  const rLL = arm.resolved.rightLowerLeg;
  const lFoot = arm.resolved.leftFoot;
  const rFoot = arm.resolved.rightFoot;
  if (!hip && !lUA && !rUA && !lUL && !rUL) return null;

  // ~150 BPM dhol pulse → 8 beats over 3.2 s, two samples per beat.
  const t = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2];
  const tracks: KeyframeTrack[] = [];
  const used = new Set<string>();

  // Vertical pop — the defining Bhangra signature.
  const amp = 0.1;
  pushPos(tracks, used, hip, t, [
    [0, 0, 0],
    [0, amp, 0],
    [0, amp * 0.2, 0],
    [0, amp, 0],
    [0, amp * 0.2, 0],
    [0, amp, 0],
    [0, amp * 0.2, 0],
    [0, amp, 0],
    [0, amp * 0.2, 0],
    [0, amp, 0],
    [0, amp * 0.2, 0],
    [0, amp, 0],
    [0, amp * 0.2, 0],
    [0, amp, 0],
    [0, amp * 0.2, 0],
    [0, amp, 0],
    [0, 0, 0],
  ]);

  // Kaintha arms — held overhead with a beat-synced pump.
  // Two cycles per clip (1.6s each). Cycle A: L leads Up, R leads Down.
  // Cycle B (frames 9-14): arms swap roles — L plays the Down-leading pattern,
  // R plays the Up-leading pattern. On loop this gives A→B→A→B…
  const lUp = [-88 * D2R, 90 * D2R, 176 * D2R];
  const lDown = [-55 * D2R, 50 * D2R, 110 * D2R];
  const rUp = [-88 * D2R, 60 * D2R, 176 * D2R];
  const rDown = [-55 * D2R, 35 * D2R, 110 * D2R];
  pushQuat(tracks, used, lUA, t, [
    [0, 0, 0],
    [-50 * D2R, 45 * D2R, 105 * D2R],
    lDown,
    lUp,
    lDown,
    lUp,
    lDown,
    lUp,
    lDown,
    lUp,
    lDown,
    lUp,
    lDown,
    lUp,
    lDown,
    [-50 * D2R, 45 * D2R, 105 * D2R],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rUA, t, [
    [0, 0, 0],
    [-50 * D2R, 32 * D2R, 105 * D2R],
    rUp,
    rDown,
    rUp,
    rDown,
    rUp,
    rDown,
    rUp,
    rDown,
    rUp,
    rDown,
    rUp,
    rDown,
    rUp,
    [-50 * D2R, 32 * D2R, 105 * D2R],
    [0, 0, 0],
  ]);

  // The smurf's arms are held straight overhead — no elbow bend (lLA/rLA stay
  // at rest), so no forearm tracks are emitted.

  // Clavicle shrugs — alternating L/R for cross-rhythm.
  // Cycle A (frames 1-8): L shrugs on odd beats, R on even.
  // Cycle B (frames 9-15): swapped — L shrugs on even, R on odd, matching the arm swap.
  const sh = 12 * D2R;
  pushQuat(tracks, used, lSh, t, [
    [0, 0, 0],
    [0, 0, 0],
    [sh, 0, 0],
    [0, 0, 0],
    [sh, 0, 0],
    [0, 0, 0],
    [sh, 0, 0],
    [0, 0, 0],
    [sh, 0, 0],
    [sh, 0, 0],
    [0, 0, 0],
    [sh, 0, 0],
    [0, 0, 0],
    [sh, 0, 0],
    [0, 0, 0],
    [sh, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rSh, t, [
    [0, 0, 0],
    [sh, 0, 0],
    [0, 0, 0],
    [sh, 0, 0],
    [0, 0, 0],
    [sh, 0, 0],
    [0, 0, 0],
    [sh, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [sh, 0, 0],
    [0, 0, 0],
    [sh, 0, 0],
    [0, 0, 0],
    [sh, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);

  // Spine counter-twist on each beat.
  const tw = 6 * D2R;
  pushQuat(tracks, used, spine, t, [
    [0, 0, 0],
    [0, tw, 0],
    [0, -tw, 0],
    [0, tw, 0],
    [0, -tw, 0],
    [0, tw, 0],
    [0, -tw, 0],
    [0, tw, 0],
    [0, -tw, 0],
    [0, tw, 0],
    [0, -tw, 0],
    [0, tw, 0],
    [0, -tw, 0],
    [0, tw, 0],
    [0, -tw, 0],
    [0, tw, 0],
    [0, 0, 0],
  ]);

  // Head bob — forward nod on the dhol downbeat.
  const nod = 5 * D2R;
  pushQuat(tracks, used, head, t, [
    [0, 0, 0],
    [nod, 0, 0],
    [0, 0, 0],
    [nod, 0, 0],
    [0, 0, 0],
    [nod, 0, 0],
    [0, 0, 0],
    [nod, 0, 0],
    [0, 0, 0],
    [nod, 0, 0],
    [0, 0, 0],
    [nod, 0, 0],
    [0, 0, 0],
    [nod, 0, 0],
    [0, 0, 0],
    [nod, 0, 0],
    [0, 0, 0],
  ]);

  // Knee springs — flex on the up-pop, settle on the beat.
  const upper = 10 * D2R;
  const lower = -18 * D2R;
  const legSpring = [
    [0, 0, 0],
    [upper, 0, 0],
    [upper * 0.3, 0, 0],
    [upper, 0, 0],
    [upper * 0.3, 0, 0],
    [upper, 0, 0],
    [upper * 0.3, 0, 0],
    [upper, 0, 0],
    [upper * 0.3, 0, 0],
    [upper, 0, 0],
    [upper * 0.3, 0, 0],
    [upper, 0, 0],
    [upper * 0.3, 0, 0],
    [upper, 0, 0],
    [upper * 0.3, 0, 0],
    [upper * 0.5, 0, 0],
    [0, 0, 0],
  ];
  const lowerSpring = [
    [0, 0, 0],
    [lower, 0, 0],
    [lower * 0.3, 0, 0],
    [lower, 0, 0],
    [lower * 0.3, 0, 0],
    [lower, 0, 0],
    [lower * 0.3, 0, 0],
    [lower, 0, 0],
    [lower * 0.3, 0, 0],
    [lower, 0, 0],
    [lower * 0.3, 0, 0],
    [lower, 0, 0],
    [lower * 0.3, 0, 0],
    [lower, 0, 0],
    [lower * 0.3, 0, 0],
    [lower * 0.5, 0, 0],
    [0, 0, 0],
  ];
  pushQuat(tracks, used, lUL, t, legSpring);
  pushQuat(tracks, used, rUL, t, legSpring);
  pushQuat(tracks, used, lLL, t, lowerSpring);
  pushQuat(tracks, used, rLL, t, lowerSpring);

  // Alternating foot taps — left on odd beats, right on even.
  const tap = 12 * D2R;
  pushQuat(tracks, used, lFoot, t, [
    [0, 0, 0],
    [tap, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [tap, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [tap, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [tap, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rFoot, t, [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [tap, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [tap, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [tap, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [tap, 0, 0],
    [0, 0, 0],
  ]);

  // Iconic point — index extended, other fingers curled into a loose fist.
  const curl = 55 * D2R;
  const pointKeys = [
    0,
    curl * 0.5,
    curl,
    curl,
    curl,
    curl,
    curl,
    curl,
    curl,
    curl,
    curl,
    curl,
    curl,
    curl,
    curl,
    curl * 0.5,
    0,
  ];
  pushPointPose(tracks, used, arm, 'left', t, pointKeys);
  pushPointPose(tracks, used, arm, 'right', t, pointKeys);

  return new THREE.AnimationClip('Bhangra dance', 3.2, tracks);
}

function buildSneakyWalk(arm: Armature): THREE.AnimationClip | null {
  const hip = arm.resolved.hip;
  const spine = arm.resolved.spine || arm.resolved.chest;
  const head = arm.resolved.head;
  const lUA = arm.resolved.leftUpperArm;
  const rUA = arm.resolved.rightUpperArm;
  const lHand = arm.resolved.leftHand;
  const rHand = arm.resolved.rightHand;
  const lUL = arm.resolved.leftUpperLeg;
  const rUL = arm.resolved.rightUpperLeg;
  const lLL = arm.resolved.leftLowerLeg;
  const rLL = arm.resolved.rightLowerLeg;
  const lFoot = arm.resolved.leftFoot;
  const rFoot = arm.resolved.rightFoot;
  if (!hip && !lUL && !rUL && !spine) return null;

  const t = [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4];
  const tracks: KeyframeTrack[] = [];
  const used = new Set<string>();

  pushPos(tracks, used, hip, t, [
    [0, 0, 0],
    [0, 0.025, 0.01],
    [0, 0, 0],
    [0, 0.025, -0.01],
    [0, 0, 0],
    [0, 0.025, 0.01],
    [0, 0, 0],
    [0, 0.025, -0.01],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, hip, t, [
    [0, 0, 0],
    [0, 0, 6 * D2R],
    [0, 0, 0],
    [0, 0, -6 * D2R],
    [0, 0, 0],
    [0, 0, 6 * D2R],
    [0, 0, 0],
    [0, 0, -6 * D2R],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, spine, t, [
    [4 * D2R, 0, 0],
    [2 * D2R, 8 * D2R, 0],
    [4 * D2R, 0, 0],
    [2 * D2R, -8 * D2R, 0],
    [4 * D2R, 0, 0],
    [2 * D2R, 8 * D2R, 0],
    [4 * D2R, 0, 0],
    [2 * D2R, -8 * D2R, 0],
    [4 * D2R, 0, 0],
  ]);
  pushQuat(tracks, used, head, t, [
    [-4 * D2R, 0, 0],
    [-3 * D2R, 14 * D2R, 0],
    [-4 * D2R, 0, 0],
    [-3 * D2R, -14 * D2R, 0],
    [-4 * D2R, 0, 0],
    [-3 * D2R, 14 * D2R, 0],
    [-4 * D2R, 0, 0],
    [-3 * D2R, -14 * D2R, 0],
    [-4 * D2R, 0, 0],
  ]);
  pushQuat(tracks, used, lUA, t, [
    [0, 0, -18 * D2R],
    [0, 0, -42 * D2R],
    [0, 0, -12 * D2R],
    [0, 0, -4 * D2R],
    [0, 0, -18 * D2R],
    [0, 0, -42 * D2R],
    [0, 0, -12 * D2R],
    [0, 0, -4 * D2R],
    [0, 0, -18 * D2R],
  ]);
  pushQuat(tracks, used, rUA, t, [
    [0, 0, 18 * D2R],
    [0, 0, 4 * D2R],
    [0, 0, 12 * D2R],
    [0, 0, 42 * D2R],
    [0, 0, 18 * D2R],
    [0, 0, 4 * D2R],
    [0, 0, 12 * D2R],
    [0, 0, 42 * D2R],
    [0, 0, 18 * D2R],
  ]);
  pushQuat(tracks, used, lHand, t, [
    [0, 0, -5 * D2R],
    [0, 0, -16 * D2R],
    [0, 0, -4 * D2R],
    [0, 0, -2 * D2R],
    [0, 0, -5 * D2R],
    [0, 0, -16 * D2R],
    [0, 0, -4 * D2R],
    [0, 0, -2 * D2R],
    [0, 0, -5 * D2R],
  ]);
  pushQuat(tracks, used, rHand, t, [
    [0, 0, 5 * D2R],
    [0, 0, 2 * D2R],
    [0, 0, 4 * D2R],
    [0, 0, 16 * D2R],
    [0, 0, 5 * D2R],
    [0, 0, 2 * D2R],
    [0, 0, 4 * D2R],
    [0, 0, 16 * D2R],
    [0, 0, 5 * D2R],
  ]);
  pushPalmShape(
    tracks,
    used,
    arm,
    'left',
    t,
    degKeys([10, 18, 8, 5, 10, 18, 8, 5, 10]),
    degKeys([2, 5, 2, 1, 2, 5, 2, 1, 2]),
  );
  pushPalmShape(
    tracks,
    used,
    arm,
    'right',
    t,
    degKeys([10, 5, 8, 18, 10, 5, 8, 18, 10]),
    degKeys([2, 1, 2, 5, 2, 1, 2, 5, 2]),
  );
  pushQuat(tracks, used, lUL, t, [
    [0, 0, 0],
    [24 * D2R, 0, 0],
    [0, 0, 0],
    [-18 * D2R, 0, 0],
    [0, 0, 0],
    [24 * D2R, 0, 0],
    [0, 0, 0],
    [-18 * D2R, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rUL, t, [
    [0, 0, 0],
    [-18 * D2R, 0, 0],
    [0, 0, 0],
    [24 * D2R, 0, 0],
    [0, 0, 0],
    [-18 * D2R, 0, 0],
    [0, 0, 0],
    [24 * D2R, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lLL, t, [
    [0, 0, 0],
    [-18 * D2R, 0, 0],
    [0, 0, 0],
    [22 * D2R, 0, 0],
    [0, 0, 0],
    [-18 * D2R, 0, 0],
    [0, 0, 0],
    [22 * D2R, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rLL, t, [
    [0, 0, 0],
    [22 * D2R, 0, 0],
    [0, 0, 0],
    [-18 * D2R, 0, 0],
    [0, 0, 0],
    [22 * D2R, 0, 0],
    [0, 0, 0],
    [-18 * D2R, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lFoot, t, [
    [0, 0, 0],
    [10 * D2R, 0, 0],
    [0, 0, 0],
    [-8 * D2R, 0, 0],
    [0, 0, 0],
    [10 * D2R, 0, 0],
    [0, 0, 0],
    [-8 * D2R, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rFoot, t, [
    [0, 0, 0],
    [-8 * D2R, 0, 0],
    [0, 0, 0],
    [10 * D2R, 0, 0],
    [0, 0, 0],
    [-8 * D2R, 0, 0],
    [0, 0, 0],
    [10 * D2R, 0, 0],
    [0, 0, 0],
  ]);

  return new THREE.AnimationClip('Sneaky walk', 2.4, tracks);
}

function buildThinkingGesture(arm: Armature): THREE.AnimationClip | null {
  const hip = arm.resolved.hip;
  const spine = arm.resolved.spine || arm.resolved.chest;
  const head = arm.resolved.head;
  const lUA = arm.resolved.leftUpperArm;
  const rUA = arm.resolved.rightUpperArm;
  const lLA = arm.resolved.leftLowerArm;
  const rLA = arm.resolved.rightLowerArm;
  const lHand = arm.resolved.leftHand;
  const rHand = arm.resolved.rightHand;
  if (!head && !rUA && !rLA) return null;

  const t = [0, 0.35, 0.75, 1.15, 1.55, 2.05, 2.55, 3.0, 3.35];
  const tracks: KeyframeTrack[] = [];
  const used = new Set<string>();

  pushPos(tracks, used, hip, t, [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0.01, 0],
    [0, 0, 0],
    [0, 0.01, 0],
    [0, 0, 0],
    [0, 0.01, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, spine, t, [
    [0, 0, 0],
    [4 * D2R, -7 * D2R, 0],
    [3 * D2R, -7 * D2R, 0],
    [5 * D2R, 6 * D2R, 0],
    [4 * D2R, 6 * D2R, 0],
    [5 * D2R, -5 * D2R, 0],
    [3 * D2R, -5 * D2R, 0],
    [2 * D2R, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, head, t, [
    [0, 0, 0],
    [8 * D2R, -16 * D2R, -5 * D2R],
    [5 * D2R, -16 * D2R, -5 * D2R],
    [10 * D2R, 10 * D2R, 5 * D2R],
    [6 * D2R, 10 * D2R, 5 * D2R],
    [9 * D2R, -8 * D2R, -4 * D2R],
    [4 * D2R, -8 * D2R, -4 * D2R],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rUA, t, [
    [0, 0, 0],
    [0, 0, 45 * D2R],
    [0, 0, 72 * D2R],
    [0, 0, 68 * D2R],
    [0, 0, 74 * D2R],
    [0, 0, 70 * D2R],
    [0, 0, 66 * D2R],
    [0, 0, 24 * D2R],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rLA, t, [
    [0, 0, 0],
    [0, -18 * D2R, 0],
    [0, -52 * D2R, 0],
    [0, -46 * D2R, 0],
    [0, -58 * D2R, 0],
    [0, -48 * D2R, 0],
    [0, -54 * D2R, 0],
    [0, -14 * D2R, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lUA, t, [
    [0, 0, 0],
    [0, 0, -24 * D2R],
    [0, 0, -34 * D2R],
    [0, 0, -30 * D2R],
    [0, 0, -36 * D2R],
    [0, 0, -30 * D2R],
    [0, 0, -34 * D2R],
    [0, 0, -12 * D2R],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lLA, t, [
    [0, 0, 0],
    [0, 14 * D2R, 0],
    [0, 24 * D2R, 0],
    [0, 18 * D2R, 0],
    [0, 26 * D2R, 0],
    [0, 18 * D2R, 0],
    [0, 22 * D2R, 0],
    [0, 8 * D2R, 0],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, rHand, t, [
    [0, 0, 0],
    [0, 0, 8 * D2R],
    [0, 0, 18 * D2R],
    [0, 0, 14 * D2R],
    [0, 0, 18 * D2R],
    [0, 0, 16 * D2R],
    [0, 0, 18 * D2R],
    [0, 0, 6 * D2R],
    [0, 0, 0],
  ]);
  pushQuat(tracks, used, lHand, t, [
    [0, 0, 0],
    [0, 0, -4 * D2R],
    [0, 0, -7 * D2R],
    [0, 0, -5 * D2R],
    [0, 0, -8 * D2R],
    [0, 0, -5 * D2R],
    [0, 0, -7 * D2R],
    [0, 0, -2 * D2R],
    [0, 0, 0],
  ]);
  pushPalmShape(
    tracks,
    used,
    arm,
    'right',
    t,
    degKeys([0, 10, 18, 15, 20, 16, 19, 6, 0]),
    degKeys([0, 2, 5, 4, 5, 4, 5, 2, 0]),
  );
  pushPalmShape(
    tracks,
    used,
    arm,
    'left',
    t,
    degKeys([0, 4, 7, 5, 8, 5, 7, 2, 0]),
    degKeys([0, 1, 3, 2, 3, 2, 3, 1, 0]),
  );

  return new THREE.AnimationClip('Thinking pose', 3.35, tracks);
}

interface Generator {
  name: string;
  needs: Role[];
  build: (arm: Armature) => THREE.AnimationClip | null;
  loop: boolean;
  additive?: boolean;
  anyOf?: boolean;
}

const GENERATORS: Generator[] = [
  { name: 'Wave', needs: ['rightUpperArm'], build: buildWave, loop: false },
  { name: 'Nod yes', needs: ['head'], build: buildNod, loop: false },
  { name: 'Shake no', needs: ['head'], build: buildShake, loop: false },
  { name: 'Look around', needs: ['head'], build: buildLookAround, loop: false },
  {
    name: 'Shrug',
    needs: ['leftShoulder', 'rightShoulder', 'leftUpperArm', 'rightUpperArm'],
    build: buildShrug,
    loop: false,
    anyOf: true,
  },
  { name: 'Bounce', needs: ['hip'], build: buildBounce, loop: true },
  {
    name: 'Dance',
    needs: ['hip', 'spine', 'leftUpperArm', 'rightUpperArm'],
    build: buildDance,
    loop: true,
    anyOf: true,
  },
  {
    name: 'Idle variation',
    needs: ['head', 'spine', 'leftUpperArm', 'rightUpperArm'],
    build: buildIdleVariation,
    loop: true,
    anyOf: true,
    additive: false,
  },
  {
    name: 'Hero entrance',
    needs: ['hip', 'spine', 'head', 'leftUpperArm', 'rightUpperArm'],
    build: buildHeroEntrance,
    loop: false,
    anyOf: true,
  },
  {
    name: 'Double clap',
    needs: ['leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm'],
    build: buildClap,
    loop: false,
    anyOf: true,
  },
  {
    name: 'Punch combo',
    needs: ['spine', 'head', 'leftUpperArm', 'rightUpperArm'],
    build: buildPunchCombo,
    loop: false,
    anyOf: true,
  },
  {
    name: 'Jump twist',
    needs: ['hip', 'spine', 'leftUpperLeg', 'rightUpperLeg'],
    build: buildJumpTwist,
    loop: false,
    anyOf: true,
  },
  {
    name: 'Sneaky walk',
    needs: ['hip', 'spine', 'leftUpperLeg', 'rightUpperLeg'],
    build: buildSneakyWalk,
    loop: true,
    anyOf: true,
  },
  {
    name: 'Bhangra dance',
    needs: ['hip', 'leftUpperArm', 'rightUpperArm', 'leftUpperLeg', 'rightUpperLeg'],
    build: buildBhangraDance,
    loop: true,
    anyOf: true,
  },
  {
    name: 'Thinking pose',
    needs: ['head', 'rightUpperArm', 'rightLowerArm'],
    build: buildThinkingGesture,
    loop: false,
    anyOf: true,
  },
];

export interface ClipStatus {
  name: string;
  ready: boolean;
  missing: Role[];
}

export interface ProcAnimations {
  actions: Map<string, AnimationAction>;
  status: ClipStatus[];
  gateInfo?: () => string;
}

export function createProcAnimations(
  armature: Armature | null,
  mixer: AnimationMixer,
): ProcAnimations {
  const actions = new Map<string, AnimationAction>();
  const status: ClipStatus[] = [];
  if (!armature || !armature.hasSkeleton) {
    return { actions, status, gateInfo: () => 'No skeleton detected' };
  }

  for (const gen of GENERATORS) {
    const missing = gen.needs.filter((r) => !armature.resolved[r]);
    const ready = gen.anyOf
      ? missing.length < gen.needs.length // any one bone is enough
      : missing.length === 0; // all bones required

    if (ready) {
      const clip = gen.build(armature);
      if (clip && clip.tracks.length > 0) {
        // Additive blend so the clip composes with idle (blink/breathing/sway)
        // and any other clip playing. Frame 0 is the rest pose, so makeClipAdditive
        // converts the remaining frames to offsets from rest.
        const additive = gen.additive !== false;
        if (additive) THREE.AnimationUtils.makeClipAdditive(clip);
        const action = additive
          ? mixer.clipAction(clip, undefined, THREE.AdditiveAnimationBlendMode)
          : mixer.clipAction(clip);
        action.setLoop(gen.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        action.clampWhenFinished = !gen.loop;
        actions.set(gen.name, action);
        status.push({ name: gen.name, ready: true, missing: [] });
        continue;
      }
    }
    status.push({ name: gen.name, ready: false, missing });
  }

  return { actions, status };
}
