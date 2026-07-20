import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { discoverMorphs, setMorph, getMorph, resetMorphs, groupByRegion } from '../src/morphs';
import { makeMorphMesh } from './helpers/rigs';

function indexOf(...meshes: THREE.Object3D[]) {
  const root = new THREE.Group();
  for (const m of meshes) root.add(m);
  return discoverMorphs(root);
}

describe('discoverMorphs', () => {
  it('indexes morphs across multiple meshes under one name', () => {
    const a = makeMorphMesh({ jawOpen: 0, mouthSmileLeft: 0 });
    const b = makeMorphMesh({ jawOpen: 0 });
    const idx = indexOf(a, b);
    expect(idx.allNames).toEqual(['jawOpen', 'mouthSmileLeft']);
    expect(idx.byName.get('jawOpen')).toHaveLength(2);
    expect(idx.arkit).toEqual(['jawOpen', 'mouthSmileLeft']);
  });

  it('classifies only ARKit names as arkit', () => {
    const idx = indexOf(makeMorphMesh({ jawOpen: 0, customThing: 0 }));
    expect(idx.allNames).toEqual(['customThing', 'jawOpen']);
    expect(idx.arkit).toEqual(['jawOpen']);
  });

  it('adds ARKit aliases for known custom morph names', () => {
    const idx = indexOf(makeMorphMesh({ 'EYES CLOSE': 0 }));
    expect(idx.byName.has('eyeBlinkLeft')).toBe(true);
    expect(idx.byName.has('eyeBlinkRight')).toBe(true);
    // Writing through the alias drives the underlying custom morph.
    setMorph(idx, 'eyeBlinkLeft', 0.7);
    expect(getMorph(idx, 'EYES CLOSE')).toBeCloseTo(0.7);
  });

  it('returns an empty index for a model without morphs', () => {
    const idx = indexOf(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()));
    expect(idx.allNames).toEqual([]);
    expect(idx.arkit).toEqual([]);
  });
});

describe('setMorph / getMorph / resetMorphs', () => {
  it('writes all bound targets and clamps to [0, 1]', () => {
    const a = makeMorphMesh({ jawOpen: 0 });
    const b = makeMorphMesh({ jawOpen: 0 });
    const idx = indexOf(a, b);
    setMorph(idx, 'jawOpen', 1.7);
    expect(a.morphTargetInfluences[0]).toBe(1);
    expect(b.morphTargetInfluences[0]).toBe(1);
    setMorph(idx, 'jawOpen', -0.5);
    expect(a.morphTargetInfluences[0]).toBe(0);
    setMorph(idx, 'jawOpen', 0.42);
    expect(getMorph(idx, 'jawOpen')).toBeCloseTo(0.42);
  });

  it('ignores unknown names', () => {
    const idx = indexOf(makeMorphMesh({ jawOpen: 0.3 }));
    expect(() => setMorph(idx, 'nope', 1)).not.toThrow();
    expect(getMorph(idx, 'nope')).toBe(0);
    expect(getMorph(idx, 'jawOpen')).toBeCloseTo(0.3);
  });

  it('resetMorphs zeroes everything', () => {
    const a = makeMorphMesh({ jawOpen: 0.5, mouthSmileLeft: 0.9 });
    const idx = indexOf(a);
    resetMorphs(idx);
    expect(a.morphTargetInfluences).toEqual([0, 0]);
  });
});

describe('groupByRegion', () => {
  it('buckets names by facial region and drops empty groups', () => {
    const groups = groupByRegion([
      'eyeBlinkLeft',
      'eyeLookUpRight',
      'browInnerUp',
      'jawOpen',
      'mouthSmileLeft',
      'cheekPuff',
      'noseSneerLeft',
      'tongueOut',
      'somethingCustom',
    ]);
    expect(groups.get('Eyes')).toEqual(['eyeBlinkLeft', 'eyeLookUpRight']);
    expect(groups.get('Brows')).toEqual(['browInnerUp']);
    expect(groups.get('Jaw')).toEqual(['jawOpen']);
    expect(groups.get('Mouth')).toEqual(['mouthSmileLeft']);
    expect(groups.get('Cheeks')).toEqual(['cheekPuff']);
    expect(groups.get('Nose')).toEqual(['noseSneerLeft']);
    expect(groups.get('Tongue')).toEqual(['tongueOut']);
    expect(groups.get('Other')).toEqual(['somethingCustom']);
    expect(groupByRegion(['jawOpen']).has('Eyes')).toBe(false);
  });
});
