import { setMorph } from './morphs.js';

// Idle behaviors are bound to the smurf armature (head/spine) + morph index.
// `rebind(armature, morphIndex)` is called once after the model loads.

export function createIdle(armature, morphIndex) {
  const state = {
    blink: { enabled: true, t: 0, next: 2 + Math.random() * 3, phase: 'idle', start: 0, dur: 0 },
    breathing: { enabled: true, t: 0 },
    headSway: { enabled: true, t: 0, suppressed: false },
  };

  let headBone = null,
    spineBone = null;
  let headBase = null,
    spineBase = 0;
  let hasBlinkL = false,
    hasBlinkR = false;
  let currentMorphIndex = morphIndex;

  function rebind(newArmature, newMorphIndex) {
    headBone = newArmature?.resolved.head || null;
    spineBone = newArmature?.resolved.spine || newArmature?.resolved.chest || null;
    headBase = headBone
      ? { x: headBone.rotation.x, y: headBone.rotation.y, z: headBone.rotation.z }
      : null;
    spineBase = spineBone ? spineBone.rotation.x : 0;
    currentMorphIndex = newMorphIndex || { byName: new Map() };
    hasBlinkL = currentMorphIndex.byName.has('eyeBlinkLeft');
    hasBlinkR = currentMorphIndex.byName.has('eyeBlinkRight');
  }
  rebind(armature, morphIndex);

  function setBlink(v) {
    if (hasBlinkL) setMorph(currentMorphIndex, 'eyeBlinkLeft', v);
    if (hasBlinkR) setMorph(currentMorphIndex, 'eyeBlinkRight', v);
  }

  function update(dt) {
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
    setBlinkEnabled: (v) => {
      state.blink.enabled = v;
      if (!v) setBlink(0);
    },
    setBreathingEnabled: (v) => {
      state.breathing.enabled = v;
    },
    setHeadSwayEnabled: (v) => {
      state.headSway.enabled = v;
    },
    suppressHeadSway: (v) => {
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
