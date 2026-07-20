import type { MorphIndex } from './morphs.js';

export type MorphValues = Record<string, number>;

export const PRESETS: Record<string, MorphValues> = {
  Neutral: {},
  Happy: {
    mouthSmileLeft: 0.8,
    mouthSmileRight: 0.8,
    cheekSquintLeft: 0.4,
    cheekSquintRight: 0.4,
    eyeSquintLeft: 0.25,
    eyeSquintRight: 0.25,
    browInnerUp: 0.15,
  },
  Sad: {
    mouthFrownLeft: 0.6,
    mouthFrownRight: 0.6,
    browInnerUp: 0.7,
    browDownLeft: 0.1,
    browDownRight: 0.1,
    eyeLookDownLeft: 0.3,
    eyeLookDownRight: 0.3,
  },
  Angry: {
    browDownLeft: 0.8,
    browDownRight: 0.8,
    noseSneerLeft: 0.4,
    noseSneerRight: 0.4,
    mouthPressLeft: 0.35,
    mouthPressRight: 0.35,
    eyeSquintLeft: 0.5,
    eyeSquintRight: 0.5,
  },
  Surprised: {
    jawOpen: 0.45,
    eyeWideLeft: 0.8,
    eyeWideRight: 0.8,
    browInnerUp: 0.6,
    browOuterUpLeft: 0.65,
    browOuterUpRight: 0.65,
  },
  Disgust: {
    noseSneerLeft: 0.7,
    noseSneerRight: 0.7,
    mouthUpperUpLeft: 0.45,
    mouthUpperUpRight: 0.45,
    browDownLeft: 0.45,
    browDownRight: 0.45,
    mouthLeft: 0.15,
  },
  Fear: {
    eyeWideLeft: 0.9,
    eyeWideRight: 0.9,
    browInnerUp: 0.8,
    jawOpen: 0.2,
    mouthStretchLeft: 0.4,
    mouthStretchRight: 0.4,
  },
  Confused: {
    browDownLeft: 0.5,
    browOuterUpRight: 0.5,
    mouthLeft: 0.25,
    eyeSquintLeft: 0.2,
  },
};

export function tweenPreset(
  morphIndex: MorphIndex,
  setMorph: (morphIndex: MorphIndex, name: string, value: number) => void,
  getMorph: (morphIndex: MorphIndex, name: string) => number,
  presetName: string,
  duration = 220,
): Promise<void> {
  const target = PRESETS[presetName] ?? {};
  // Snapshot every ARKit-ish morph currently in the index so non-target morphs return to 0.
  const startValues = new Map<string, number>();
  for (const name of morphIndex.byName.keys()) {
    startValues.set(name, getMorph(morphIndex, name));
  }
  const endValues = new Map<string, number>();
  for (const name of morphIndex.byName.keys()) {
    endValues.set(name, target[name] ?? 0);
  }

  const t0 = performance.now();
  return new Promise((resolve) => {
    function step(now: number) {
      const t = Math.min(1, (now - t0) / duration);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      for (const [name, start] of startValues) {
        const end = endValues.get(name) ?? 0;
        setMorph(morphIndex, name, start + (end - start) * e);
      }
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}
