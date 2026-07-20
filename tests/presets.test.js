import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { PRESETS, tweenPreset } from '../src/presets.js';
import { discoverMorphs, setMorph, getMorph } from '../src/morphs.js';
import { makeMorphMesh, installFakeRaf } from './helpers/rigs.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PRESETS', () => {
  it('Neutral is empty', () => {
    expect(PRESETS.Neutral).toEqual({});
  });

  it('uses only valid ARKit names with values in [0, 1]', () => {
    const used = new Set();
    for (const preset of Object.values(PRESETS)) {
      for (const [name, v] of Object.entries(preset)) {
        used.add(name);
        expect(v, name).toBeGreaterThan(0);
        expect(v, name).toBeLessThanOrEqual(1);
      }
    }
    const root = new THREE.Group();
    root.add(makeMorphMesh(Object.fromEntries([...used].map((n) => [n, 0]))));
    const idx = discoverMorphs(root);
    for (const name of used) {
      expect(idx.arkit, `${name} should be an ARKit blendshape`).toContain(name);
    }
  });
});

describe('tweenPreset', () => {
  function makeIndex(extra = {}) {
    const names = { jawOpen: 0, mouthSmileLeft: 0, mouthSmileRight: 0, browInnerUp: 0, ...extra };
    const root = new THREE.Group();
    root.add(makeMorphMesh(names));
    return discoverMorphs(root);
  }

  it('lands exactly on the preset values and resolves', async () => {
    const raf = installFakeRaf(vi);
    const idx = makeIndex();
    const done = tweenPreset(idx, setMorph, getMorph, 'Happy', 200);
    raf.advance(50);
    raf.advance(100);
    raf.advance(100); // past the 200ms duration -> final frame
    await done;
    expect(getMorph(idx, 'mouthSmileLeft')).toBeCloseTo(PRESETS.Happy.mouthSmileLeft);
    expect(getMorph(idx, 'mouthSmileRight')).toBeCloseTo(PRESETS.Happy.mouthSmileRight);
    expect(getMorph(idx, 'browInnerUp')).toBeCloseTo(PRESETS.Happy.browInnerUp);
  });

  it('returns morphs outside the preset to zero', async () => {
    const raf = installFakeRaf(vi);
    const idx = makeIndex();
    setMorph(idx, 'jawOpen', 0.9);
    const done = tweenPreset(idx, setMorph, getMorph, 'Happy', 100);
    raf.advance(60);
    raf.advance(60);
    await done;
    expect(getMorph(idx, 'jawOpen')).toBe(0);
  });

  it('treats an unknown preset as neutral', async () => {
    const raf = installFakeRaf(vi);
    const idx = makeIndex();
    setMorph(idx, 'jawOpen', 0.4);
    const done = tweenPreset(idx, setMorph, getMorph, 'DoesNotExist', 100);
    raf.advance(120);
    await done;
    expect(getMorph(idx, 'jawOpen')).toBe(0);
  });
});
