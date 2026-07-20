import { describe, it, expect } from 'vitest';
import { createIdle } from '../src/idle';
import { detectArmature } from '../src/armature';
import { discoverMorphs, getMorph } from '../src/morphs';
import { makeRig, makeMorphMesh } from './helpers/rigs';

function makeContext() {
  const root = makeRig('rpm');
  root.add(makeMorphMesh({ eyeBlinkLeft: 0, eyeBlinkRight: 0 }));
  const armature = detectArmature(root);
  const morphIndex = discoverMorphs(root);
  return { armature, morphIndex };
}

describe('blink', () => {
  it('runs the close/open phase machine and restores open eyes', () => {
    const { armature, morphIndex } = makeContext();
    const idle = createIdle(armature, morphIndex);

    // Force the next blink to be imminent instead of waiting out the random timer.
    idle.state.blink.next = 0.5;
    idle.update(0.6); // idle -> closing
    expect(idle.state.blink.phase).toBe('closing');
    idle.update(0.08); // fully closed
    expect(getMorph(morphIndex, 'eyeBlinkLeft')).toBe(1);
    expect(getMorph(morphIndex, 'eyeBlinkRight')).toBe(1);
    expect(idle.state.blink.phase).toBe('opening');
    idle.update(0.14); // fully open again
    expect(getMorph(morphIndex, 'eyeBlinkLeft')).toBe(0);
    expect(idle.state.blink.phase).toBe('idle');
  });

  it('setBlinkEnabled(false) clears any blink', () => {
    const { armature, morphIndex } = makeContext();
    const idle = createIdle(armature, morphIndex);
    idle.state.blink.next = 0.1;
    idle.update(0.2);
    idle.update(0.08); // eyes closed
    idle.setBlinkEnabled(false);
    expect(getMorph(morphIndex, 'eyeBlinkLeft')).toBe(0);
  });
});

describe('breathing', () => {
  it('modulates the spine around its base rotation and restores it when disabled', () => {
    const { armature, morphIndex } = makeContext();
    const idle = createIdle(armature, morphIndex);
    const spine = idle.spineBone!;
    const base = spine.rotation.x;

    idle.update(1); // sin(pi/2) = 1 -> maximum amplitude
    expect(spine.rotation.x).toBeCloseTo(base + 0.008, 5);

    idle.setBreathingEnabled(false);
    idle.update(0.016);
    expect(spine.rotation.x).toBe(base);
  });
});

describe('head sway', () => {
  it('sways the head and eases back when suppressed', () => {
    const { armature, morphIndex } = makeContext();
    const idle = createIdle(armature, morphIndex);
    const head = idle.headBone!;
    const baseY = head.rotation.y;

    idle.update(1);
    const swayed = head.rotation.y;
    expect(swayed).not.toBe(baseY);

    idle.suppressHeadSway(true);
    for (let i = 0; i < 60; i++) idle.update(0.1);
    expect(head.rotation.y).toBeCloseTo(baseY, 3);
  });
});

describe('rebind', () => {
  it('tolerates rebinding to nothing', () => {
    const { armature, morphIndex } = makeContext();
    const idle = createIdle(armature, morphIndex);
    idle.rebind(null, null);
    expect(() => idle.update(0.016)).not.toThrow();
    expect(idle.headBone).toBeNull();
    expect(idle.spineBone).toBeNull();
  });

  it('picks up new head/spine bones after an override', () => {
    const { armature, morphIndex } = makeContext();
    const idle = createIdle(armature, morphIndex);
    armature.setOverride('head', 'Neck');
    idle.rebind(armature, morphIndex);
    expect(idle.headBone?.name).toBe('Neck');
  });
});
