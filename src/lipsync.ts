// Lip-sync remap: Oculus-style viseme codes -> ARKit morph combos available on this avatar.
// Adapted from the TalkingHead library's viseme timing concept; values are reduced/empirical
// because we have no true Oculus visemes, only ARKit blendshapes to approximate them.

import { setMorph } from './morphs';
import type { MorphIndex } from './morphs';

export type Viseme =
  | 'PP'
  | 'FF'
  | 'TH'
  | 'DD'
  | 'KK'
  | 'CH'
  | 'SS'
  | 'NN'
  | 'RR'
  | 'AA'
  | 'E'
  | 'I'
  | 'O'
  | 'U'
  | 'sil';

export const VISEME_TO_ARKIT: Record<Viseme, Record<string, number>> = {
  PP: { mouthPucker: 0.4, mouthClose: 0.6, mouthRollLower: 0.3, mouthRollUpper: 0.3 },
  FF: { mouthFunnel: 0.3, mouthLowerDownLeft: 0.3, mouthLowerDownRight: 0.3 },
  TH: { tongueOut: 0.3, jawOpen: 0.2 },
  DD: { jawOpen: 0.25, mouthStretchLeft: 0.2, mouthStretchRight: 0.2 },
  KK: { jawOpen: 0.2, mouthStretchLeft: 0.15, mouthStretchRight: 0.15 },
  CH: { mouthFunnel: 0.5, mouthPucker: 0.3, jawOpen: 0.15 },
  SS: { mouthStretchLeft: 0.3, mouthStretchRight: 0.3, jawOpen: 0.1 },
  NN: { jawOpen: 0.2, tongueOut: 0.1 },
  RR: { mouthPucker: 0.5, mouthFunnel: 0.3, jawOpen: 0.2 },
  AA: { jawOpen: 0.6, mouthStretchLeft: 0.3, mouthStretchRight: 0.3 },
  E: { jawOpen: 0.35, mouthStretchLeft: 0.5, mouthStretchRight: 0.5 },
  I: { jawOpen: 0.2, mouthStretchLeft: 0.6, mouthStretchRight: 0.6 },
  O: { jawOpen: 0.45, mouthFunnel: 0.5, mouthPucker: 0.3 },
  U: { jawOpen: 0.25, mouthPucker: 0.7, mouthFunnel: 0.4 },
  sil: {},
};

// Letter -> viseme (rough English mapping borrowed from TalkingHead's lipsync-en intent).
const LETTER_TO_VISEME: Record<string, Viseme> = {
  a: 'AA',
  e: 'E',
  i: 'I',
  o: 'O',
  u: 'U',
  b: 'PP',
  p: 'PP',
  m: 'PP',
  f: 'FF',
  v: 'FF',
  t: 'DD',
  d: 'DD',
  n: 'NN',
  k: 'KK',
  g: 'KK',
  s: 'SS',
  z: 'SS',
  r: 'RR',
  l: 'NN',
  h: 'sil',
  y: 'I',
  w: 'U',
  c: 'KK',
  j: 'CH',
  q: 'KK',
  x: 'KK',
};

export function textToVisemes(text: string): Viseme[] {
  const out: Viseme[] = [];
  const clean = String(text).toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (!ch) continue;
    if (ch === ' ' || ch === '.' || ch === ',') {
      out.push('sil');
      continue;
    }
    const next2 = clean.slice(i, i + 2);
    if (next2 === 'th') {
      out.push('TH');
      i++;
      continue;
    }
    if (next2 === 'sh' || next2 === 'ch') {
      out.push('CH');
      i++;
      continue;
    }
    const v = LETTER_TO_VISEME[ch];
    if (v) out.push(v);
  }
  return out;
}

const ALL_LIPSYNC_MORPHS = new Set<string>();
for (const v of Object.values(VISEME_TO_ARKIT)) {
  for (const k of Object.keys(v)) ALL_LIPSYNC_MORPHS.add(k);
}

function applyViseme(morphIndex: MorphIndex, code: Viseme, intensity = 1) {
  const target = VISEME_TO_ARKIT[code] ?? {};
  for (const morph of ALL_LIPSYNC_MORPHS) {
    setMorph(morphIndex, morph, (target[morph] ?? 0) * intensity);
  }
}

function clearVisemes(morphIndex: MorphIndex) {
  for (const morph of ALL_LIPSYNC_MORPHS) setMorph(morphIndex, morph, 0);
}

// Plays a viseme sequence on a fixed clock — no audio. Useful to verify the remap visually.
// Returns a cancel function that clears the mouth immediately.
export function playVisemeSequence(
  morphIndex: MorphIndex,
  visemes: Viseme[],
  msPerViseme = 90,
): () => void {
  let i = 0;
  let cancelled = false;
  const t0 = performance.now();

  function step(now: number) {
    if (cancelled) return;
    const idx = Math.floor((now - t0) / msPerViseme);
    if (idx >= visemes.length) {
      clearVisemes(morphIndex);
      return;
    }
    if (idx !== i) {
      i = idx;
      const code = visemes[i];
      if (code) applyViseme(morphIndex, code);
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  return () => {
    cancelled = true;
    clearVisemes(morphIndex);
  };
}

// Placeholder for future TTS hookup — same signatures TalkingHead uses.
export async function speak(_text: string) {
  /* not implemented */
}
export async function speakAudio(_payload: unknown) {
  /* not implemented */
}
