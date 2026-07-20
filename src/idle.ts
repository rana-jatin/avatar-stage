import { setMorph } from './morphs.js';
import type { MorphIndex } from './morphs.js';
import type { Armature } from './armature.js';
import type { Bone } from 'three';

// Idle behaviors are bound to the detected armature (head/spine) + morph index.
// `rebind(armature, morphIndex)` is called after each model load.

export interface IdleState {
  blink: {
    enabled: boolean;
    t: number;
    next: number;
    phase: 'idle' | 'closing' | 'opening';
    start: number;
    dur: number;
  };
  breathing: { enabled: boolean; t: number };
  headSway: { enabled: boolean; t: number; suppressed: boolean };
}

export interface IdleController {
  update: (dt: number) => void;
  rebind: (armature: Armature | null, morphIndex: MorphIndex | null) => void;
  setBlinkEnabled: (v: boolean) => void;
  setBreathingEnabled: (v: boolean) => void;
  setHeadSwayEnabled: (v: boolean) => void;
  suppressHeadSway: (v: boolean) => void;
  state: IdleState;
  readonly headBone: Bone | null;
  readonly spineBone: Bone | null;
}

const EMPTY_MORPH_INDEX: MorphIndex = { byName: new Map(), allNames: [], arkit: [] };

export function createIdle(
  armature: Armature | null,
  morphIndex: MorphIndex | null,
): IdleController {
  const state: IdleState = {
    blink: { enabled: true, t: 0, next: 2 + Math.random() * 3, phase: 'idle', start: 0, dur: 0 },
    breathing: { enabled: true, t: 0 },
    headSway: { enabled: true, t: 0, suppressed: false },
  };

  let headBone: Bone | null = null,
    spineBone: Bone | null = null;
  let headBase: { x: number; y: number; z: number } | null = null,
    spineBase = 0;
  let hasBlinkL = false,
    hasBlinkR = false;
  let currentMorphIndex = morphIndex ?? EMPTY_MORPH_INDEX;

  function rebind(newArmature: Armature | null, newMorphIndex: MorphIndex | null) {
    headBone = newArmature?.resolved.head || null;
    spineBone = newArmature?.resolved.spine || newArmature?.resolved.chest || null;
    headBase = headBone
      ? { x: headBone.rotation.x, y: headBone.rotation.y, z: headBone.rotation.z }
      : null;
    spineBase = spineBone ? spineBone.rotation.x : 0;
    currentMorphIndex = newMorphIndex || EMPTY_MORPH_INDEX;
    hasBlinkL = currentMorphIndex.byName.has('eyeBlinkLeft');
    hasBlinkR = currentMorphIndex.byName.has('eyeBlinkRight');
  }
  rebind(armature, morphIndex);

  function setBlink(v: number) {
    if (hasBlinkL) setMorph(currentMorphIndex, 'eyeBlinkLeft', v);
    if (hasBlinkR) setMorph(currentMorphIndex, 'eyeBlinkRight', v);
  }

  function update(dt: number) {
    if (state.blink.enabled && (hasBlinkL || hasBlinkR)) {
      const b = state.blink;
      if (b.phase === 'idle') {
        b.t += dt;
        if (b.t >= b.next) {
          b.phase = 'closing';
          b.start = 0;
          b.dur = 0.08;
          b.t = 0;
        }
      } else if (b.phase === 'closing') {
        b.start += dt;
        const p = Math.min(1, b.start / b.dur);
        setBlink(p);
        if (p >= 1) {
          b.phase = 'opening';
          b.start = 0;
          b.dur = 0.14;
        }
      } else if (b.phase === 'opening') {
        b.start += dt;
        const p = Math.min(1, b.start / b.dur);
        setBlink(1 - p);
        if (p >= 1) {
          b.phase = 'idle';
          b.t = 0;
          b.next = 2.5 + Math.random() * 3.5;
        }
      }
    }

    if (state.breathing.enabled && spineBone) {
      state.breathing.t += dt;
      const amp = 0.008;
      spineBone.rotation.x = spineBase + Math.sin(state.breathing.t * ((2 * Math.PI) / 4)) * amp;
    } else if (spineBone) {
      spineBone.rotation.x = spineBase;
    }

    if (state.headSway.enabled && headBone && headBase && !state.headSway.suppressed) {
      state.headSway.t += dt;
      const t = state.headSway.t;
      const yaw = Math.sin(t * 0.6) * 0.025 + Math.sin(t * 0.21) * 0.015;
      const pitch = Math.sin(t * 0.43) * 0.015;
      headBone.rotation.y = headBase.y + yaw;
      headBone.rotation.x = headBase.x + pitch;
    } else if (headBone && headBase) {
      headBone.rotation.y += (headBase.y - headBone.rotation.y) * Math.min(1, dt * 4);
      headBone.rotation.x += (headBase.x - headBone.rotation.x) * Math.min(1, dt * 4);
    }
  }

  return {
    update,
    rebind,
    setBlinkEnabled: (v: boolean) => {
      state.blink.enabled = v;
      if (!v) setBlink(0);
    },
    setBreathingEnabled: (v: boolean) => {
      state.breathing.enabled = v;
    },
    setHeadSwayEnabled: (v: boolean) => {
      state.headSway.enabled = v;
    },
    suppressHeadSway: (v: boolean) => {
      state.headSway.suppressed = v;
    },
    state,
    get headBone() {
      return headBone;
    },
    get spineBone() {
      return spineBone;
    },
  };
}
