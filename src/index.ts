// Public API of avatar-stage.
//
// Consumers install `three` themselves (it is a peer dependency) and compose
// these pieces: create a viewer, load a rigged GLB, and drive the detected
// armature with procedural clips, expression presets, visemes, or idle motion.

export { createViewer } from './viewer.js';
export type { Viewer } from './viewer.js';

export { detectArmature, ROLES } from './armature.js';
export type { Armature, ResolvedRoles, Role } from './armature.js';

export { createProcAnimations } from './procAnim.js';
export type { ProcAnimations, ClipStatus } from './procAnim.js';

export { discoverMorphs, setMorph, getMorph, resetMorphs, groupByRegion } from './morphs.js';
export type { MorphIndex, MorphMesh, MorphTargetRef } from './morphs.js';

export { PRESETS, tweenPreset } from './presets.js';
export type { MorphValues } from './presets.js';

export { VISEME_TO_ARKIT, textToVisemes, playVisemeSequence } from './lipsync.js';
export type { Viseme } from './lipsync.js';

export { createIdle } from './idle.js';
export type { IdleController, IdleState } from './idle.js';

export { setDebug, isDebug, dlog } from './debug.js';
