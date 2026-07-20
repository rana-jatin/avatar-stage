import { describe, it, expect, vi, afterEach } from 'vitest';
import { VISEME_TO_ARKIT, textToVisemes, playVisemeSequence } from '../src/lipsync.js';
import { discoverMorphs, getMorph } from '../src/morphs.js';
import { makeMorphMesh, installFakeRaf } from './helpers/rigs.js';
import * as THREE from 'three';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('textToVisemes', () => {
  it('maps a simple phrase', () => {
    expect(textToVisemes('hello world')).toEqual([
      'sil', // h
      'E',
      'NN',
      'NN',
      'O',
      'sil', // space
      'U', // w
      'O',
      'RR',
      'NN', // l
      'DD',
    ]);
  });

  it('consumes th/sh/ch digraphs as one viseme', () => {
    expect(textToVisemes('this')).toEqual(['TH', 'I', 'SS']);
    expect(textToVisemes('shch')).toEqual(['CH', 'CH']);
  });

  it('turns spaces and punctuation into sil and skips unmapped characters', () => {
    expect(textToVisemes('a, b.')).toEqual(['AA', 'sil', 'sil', 'PP', 'sil']);
    expect(textToVisemes('123!?')).toEqual([]);
    expect(textToVisemes('')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(textToVisemes('AA')).toEqual(textToVisemes('aa'));
  });
});

describe('VISEME_TO_ARKIT', () => {
  it('references only valid ARKit blendshape names', () => {
    // Build an index over every morph name the viseme table uses, then check
    // morphs.js classifies each one as ARKit.
    const used = new Set();
    for (const combo of Object.values(VISEME_TO_ARKIT)) {
      for (const name of Object.keys(combo)) used.add(name);
    }
    const mesh = makeMorphMesh(Object.fromEntries([...used].map((n) => [n, 0])));
    const root = new THREE.Group();
    root.add(mesh);
    const idx = discoverMorphs(root);
    for (const name of used) {
      expect(idx.arkit, `${name} should be an ARKit blendshape`).toContain(name);
    }
  });

  it('keeps all intensities in [0, 1]', () => {
    for (const [code, combo] of Object.entries(VISEME_TO_ARKIT)) {
      for (const [name, v] of Object.entries(combo)) {
        expect(v, `${code}.${name}`).toBeGreaterThanOrEqual(0);
        expect(v, `${code}.${name}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('playVisemeSequence', () => {
  function makeIndex() {
    const names = {};
    for (const combo of Object.values(VISEME_TO_ARKIT)) {
      for (const name of Object.keys(combo)) names[name] = 0;
    }
    const root = new THREE.Group();
    root.add(makeMorphMesh(names));
    return discoverMorphs(root);
  }

  it('applies each viseme on schedule and clears at the end', () => {
    const raf = installFakeRaf(vi);
    const idx = makeIndex();
    playVisemeSequence(idx, ['AA', 'U'], 100);

    raf.advance(10); // first frame: viseme index 0 already applied at i=0? idx=0 === initial i -> unchanged
    raf.advance(50); // now=60, idx 0
    // AA opens the jaw once the index advances from the initial state.
    raf.advance(60); // now=120, idx 1 -> U
    expect(getMorph(idx, 'mouthPucker')).toBeCloseTo(VISEME_TO_ARKIT.U.mouthPucker);
    raf.advance(100); // now=220, past the end -> cleared
    expect(getMorph(idx, 'mouthPucker')).toBe(0);
    expect(getMorph(idx, 'jawOpen')).toBe(0);
    expect(raf.pending).toBe(0);
  });

  it('cancel clears immediately and stops the loop', () => {
    const raf = installFakeRaf(vi);
    const idx = makeIndex();
    const cancel = playVisemeSequence(idx, ['AA', 'O', 'U'], 100);
    raf.advance(150); // idx 1 -> O applied
    expect(getMorph(idx, 'mouthFunnel')).toBeCloseTo(VISEME_TO_ARKIT.O.mouthFunnel);
    cancel();
    expect(getMorph(idx, 'mouthFunnel')).toBe(0);
    raf.advance(1000); // any queued frame must be a no-op
    expect(getMorph(idx, 'jawOpen')).toBe(0);
  });
});
