import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createProcAnimations } from '../src/procAnim';
import { detectArmature } from '../src/armature';
import { makeSmurfRig } from './helpers/rigs';

const EXPECTED_CLIPS = [
  'Wave',
  'Nod yes',
  'Shake no',
  'Look around',
  'Shrug',
  'Bounce',
  'Dance',
  'Idle variation',
  'Hero entrance',
  'Double clap',
  'Punch combo',
  'Jump twist',
  'Sneaky walk',
  'Bhangra dance',
  'Thinking pose',
];

function makeFullSetup() {
  const root = makeSmurfRig();
  const armature = detectArmature(root);
  const mixer = new THREE.AnimationMixer(root);
  return { root, armature, mixer };
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

function serializeClip(clip: THREE.AnimationClip) {
  return clip.tracks.map((t) => ({
    name: t.name,
    times: Array.from(t.times, round6),
    values: Array.from(t.values, round6),
  }));
}

describe('createProcAnimations on the full smurf rig', () => {
  const { armature, mixer } = makeFullSetup();
  const { actions, status } = createProcAnimations(armature, mixer);

  it('generates every clip', () => {
    expect(status.map((s) => s.name)).toEqual(EXPECTED_CLIPS);
    expect([...actions.keys()]).toEqual(EXPECTED_CLIPS);
    for (const s of status) {
      expect(s.ready, s.name).toBe(true);
      expect(s.missing, s.name).toEqual([]);
    }
  });

  it('produces valid, finite, bone-targeted tracks', () => {
    const boneNames = new Set(armature.bones.keys());
    for (const [name, action] of actions) {
      const clip = action.getClip();
      expect(clip.validate(), `${name} validates`).toBe(true);
      expect(clip.duration, `${name} duration`).toBeGreaterThan(0);
      expect(clip.tracks.length, `${name} has tracks`).toBeGreaterThan(0);
      for (const track of clip.tracks) {
        const target = track.name.slice(0, track.name.lastIndexOf('.'));
        expect(boneNames.has(target), `${name}: ${track.name} targets a bone`).toBe(true);
        for (const v of track.values)
          expect(Number.isFinite(v), `${name}: finite values`).toBe(true);
      }
    }
  });

  it('matches the hand-tuned keyframe snapshot', () => {
    // Freezes every generated track (post-additive conversion) so refactors —
    // in particular the TypeScript migration — cannot silently change the
    // animation data. Only update this snapshot for a deliberate re-tune.
    const serialized: Record<string, ReturnType<typeof serializeClip>> = {};
    for (const [name, action] of actions) {
      serialized[name] = serializeClip(action.getClip());
    }
    expect(serialized).toMatchSnapshot();
  });
});

describe('createProcAnimations on partial rigs', () => {
  it('reports missing bones instead of throwing', () => {
    // Head + torso only: no arms, no legs.
    const root = new THREE.Group();
    const hip = new THREE.Bone();
    hip.name = 'Bone001';
    const spine = new THREE.Bone();
    spine.name = 'Bone002';
    const head = new THREE.Bone();
    head.name = 'head';
    root.add(hip);
    hip.add(spine);
    spine.add(head);

    const armature = detectArmature(root);
    const mixer = new THREE.AnimationMixer(root);
    const { actions, status } = createProcAnimations(armature, mixer);

    const byName = new Map(status.map((s) => [s.name, s]));
    expect(byName.get('Wave')?.ready).toBe(false);
    expect(byName.get('Wave')?.missing).toEqual(['rightUpperArm']);
    expect(byName.get('Nod yes')?.ready).toBe(true);
    expect(byName.get('Bounce')?.ready).toBe(true);
    expect(actions.has('Wave')).toBe(false);
    expect(actions.has('Nod yes')).toBe(true);
  });

  it('returns an inert result without a skeleton', () => {
    const root = new THREE.Group();
    const armature = detectArmature(root);
    const mixer = new THREE.AnimationMixer(root);
    const { actions, status } = createProcAnimations(armature, mixer);
    expect(actions.size).toBe(0);
    expect(status).toEqual([]);
  });
});
