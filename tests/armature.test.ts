import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { detectArmature, ROLES } from '../src/armature';
import type { Role } from '../src/armature';
import { makeRig, makeSmurfRig, makeGarbageRig } from './helpers/rigs';

const CORE_ROLES: Role[] = [
  'hip',
  'spine',
  'head',
  'leftShoulder',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightShoulder',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
  'leftUpperLeg',
  'leftLowerLeg',
  'leftFoot',
  'rightUpperLeg',
  'rightLowerLeg',
  'rightFoot',
];

const PALM_ROLES: Role[] = [
  'leftIndexPalm',
  'leftMiddlePalm',
  'leftRingPalm',
  'leftPinkyPalm',
  'rightIndexPalm',
  'rightMiddlePalm',
  'rightRingPalm',
  'rightPinkyPalm',
];

describe('generic rig families', () => {
  for (const family of ['mixamo', 'rpm', 'cc4', 'vroid', 'rigify']) {
    it(`resolves ${family} naming`, () => {
      const arm = detectArmature(makeRig(family));
      expect(arm.hasSkeleton).toBe(true);
      expect(arm.rig).toBe(family);
      for (const role of CORE_ROLES) {
        expect(arm.resolved[role], `role ${role}`).toBeTruthy();
      }
      for (const role of PALM_ROLES) {
        expect(arm.resolved[role], `role ${role}`).toBeTruthy();
      }
    });
  }
});

describe('smurf rig', () => {
  for (const dotted of [false, true]) {
    it(`resolves ${dotted ? 'dotted' : 'undotted'} bone names`, () => {
      const arm = detectArmature(makeSmurfRig({ dotted }));
      expect(arm.rig).toBe('smurf');
      for (const role of ROLES) {
        expect(arm.resolved[role], `role ${role}`).toBeTruthy();
      }
      expect(arm.resolved.head?.name).toBe('head');
    });
  }

  it('prefers the generic strategy when it resolves more roles', () => {
    // A full mixamo rig plus a stray bone named `head` — the smurf map would
    // match only that one bone, so the generic strategy must win.
    const root = makeRig('mixamo');
    const stray = new THREE.Bone();
    stray.name = 'head';
    root.add(stray);
    const arm = detectArmature(root);
    expect(arm.rig).toBe('mixamo');
    expect(arm.resolved.head?.name).toBe('mixamorigHead');
  });
});

describe('unknown rigs', () => {
  it('falls back to hierarchy heuristics', () => {
    const arm = detectArmature(makeGarbageRig());
    expect(arm.hasSkeleton).toBe(true);
    expect(arm.rig).toBe('unknown');
    // Root of the chain becomes the hip, the tip becomes the head.
    expect(arm.resolved.hip?.name).toBe('alpha');
    expect(arm.resolved.head?.name).toBe('gamma');
  });

  it('returns a safe empty armature when there is no skeleton', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()));
    const arm = detectArmature(root);
    expect(arm.hasSkeleton).toBe(false);
    expect(arm.rig).toBe('unknown');
    expect(arm.setOverride('head', 'anything')).toBe(false);
    expect(arm.getRole('head')).toBeNull();
    for (const role of ROLES) expect(arm.resolved[role]).toBeNull();
  });
});

describe('setOverride', () => {
  it('remaps a role to another bone and clears it', () => {
    const arm = detectArmature(makeRig('rpm'));
    expect(arm.setOverride('head', 'Neck')).toBe(true);
    expect(arm.getRole('head')?.name).toBe('Neck');
    expect(arm.setOverride('head', '')).toBe(true);
    expect(arm.getRole('head')).toBeNull();
    expect(arm.setOverride('head', null)).toBe(true);
  });

  it('rejects unknown roles and unknown bones, keeping the previous mapping', () => {
    const arm = detectArmature(makeRig('rpm'));
    expect(arm.setOverride('tail', 'Head')).toBe(false);
    expect(arm.setOverride('head', 'NoSuchBone')).toBe(false);
    expect(arm.getRole('head')?.name).toBe('Head');
  });
});
