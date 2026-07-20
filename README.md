# avatar-stage

[![CI](https://github.com/rana-jatin/avatar-stage/actions/workflows/ci.yml/badge.svg)](https://github.com/rana-jatin/avatar-stage/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Three.js toolkit for rigged GLB avatars. Point it at a humanoid model and it
figures out the skeleton, generates a library of procedural animations at
runtime, and gives you ARKit expression presets, viseme lip-sync, and idle
behaviors — without authoring a single keyframe.

**[▶ Live demo](https://rana-jatin.github.io/avatar-stage/)** — loads a bundled
CC0 character; drop your own `.glb` on the stage to swap it.

![The avatar dashboard: a low-poly character on the left, animation and
blendshape controls on the right](docs/media/dashboard.png)

## Why

Every avatar project re-solves the same problems: this rig calls the head bone
`mixamorigHead`, that one calls it `J_Bip_C_Head`, and a third just numbers
its bones. Animations authored for one skeleton don't play on another.
`avatar-stage` normalizes rigs onto canonical humanoid roles, then builds
motion against those roles — so the same "wave" works on a Mixamo export, a
Ready Player Me avatar, or a hand-rigged Blender character.

## Features

- **Rig detection** across Mixamo, Character Creator 4, Ready Player Me, VRoid,
  and Rigify, with hierarchy and keyword fallbacks for unknown naming schemes
- **15 procedural animation clips** generated at load time — wave, nod, shrug,
  dance, bhangra, clap, punch combo, jump twist, sneaky walk, thinking pose and
  more — each gated on the bones it actually needs, so partial rigs degrade
  gracefully instead of throwing
- **Additive blending**, so procedural motion composes with embedded clips and
  idle behavior rather than fighting them
- **ARKit blendshapes**: eight expression presets with eased tweening, plus
  alias mapping for models that ship non-standard morph names
- **Viseme lip-sync** from plain text (no audio required)
- **Idle behaviors**: auto-blink, breathing, head sway
- **Manual bone remapping** when detection guesses wrong

## Install

```bash
npm install avatar-stage three
```

`three` is a peer dependency (>= 0.160). TypeScript users also want
`@types/three`.

## Usage

```ts
import {
  createViewer,
  createIdle,
  createProcAnimations,
  PRESETS,
  tweenPreset,
  setMorph,
  getMorph,
} from 'avatar-stage';

const canvas = document.querySelector('canvas')!;
const viewer = createViewer(canvas, (msg) => console.log(msg));

// Idle motion rebinds itself whenever a new model loads.
const idle = createIdle(null, null);
viewer.setIdleUpdate(idle.update);

viewer.onModelLoaded = (v) => {
  idle.rebind(v.armature, v.morphIndex);

  // Procedural clips are ready-made AnimationActions.
  v.procAnimations.actions.get('Wave')?.reset().play();

  // Expression presets tween over the ARKit morphs the model exposes.
  void tweenPreset(v.morphIndex, setMorph, getMorph, 'Happy');
};

await viewer.loadGLB('/models/my-avatar.glb');
```

`loadGLB` also accepts an `ArrayBuffer`, which is what the demo's file picker
and drag-and-drop use. Call `viewer.dispose()` to stop the render loop and
release GPU resources.

Working with the pieces directly, without the viewer:

```ts
import { detectArmature, createProcAnimations, textToVisemes } from 'avatar-stage';
import * as THREE from 'three';

const armature = detectArmature(gltf.scene);
console.log(armature.rig, armature.resolved.head?.name);

const mixer = new THREE.AnimationMixer(gltf.scene);
const { actions, status } = createProcAnimations(armature, mixer);
// status tells you which clips are unavailable and which bones they wanted:
status.filter((s) => !s.ready).forEach((s) => console.log(s.name, s.missing));

textToVisemes('hello world'); // ['sil','E','NN','NN','O','sil','U','O','RR','NN','DD']
```

## Rig compatibility

| Rig family          | Detected as | Notes                          |
| ------------------- | ----------- | ------------------------------ |
| Mixamo              | `mixamo`    | `mixamorig*` prefix            |
| Character Creator 4 | `cc4`       | `CC_Base_*`                    |
| Ready Player Me     | `rpm`       | Plain `Hips` / `Head`          |
| VRoid / VRM         | `vroid`     | `J_Bip_*`                      |
| Rigify              | `rigify`    | `DEF-*` and `*.x`              |
| Numbered / custom   | `smurf`     | `Bone.001`-style skeletons     |
| Anything else       | `unknown`   | Hierarchy + keyword heuristics |

Expression presets and lip-sync need ARKit blendshapes on the model. The
bundled demo character has none (it's a game-style low-poly mesh), so those
panels stay inert until you load a model that has them — a Ready Player Me
export is the easiest way to try them.

## Repo layout

```
src/     the published library (rig detection, animation, morphs, viewer)
demo/    the dashboard app; imports the library through src/index.ts
tests/   Vitest suites, including a snapshot that freezes the keyframe data
```

The demo consumes the library through its public barrel, so anything the
dashboard can do is reachable from the published package.

## Development

```bash
npm install
npm run dev          # dashboard at localhost:5173
npm test             # Vitest
npm run typecheck    # tsc --noEmit
npm run lint
npm run build        # library -> dist/
npm run build:demo   # dashboard -> dist-demo/
```

Append `?debug` to the demo URL for diagnostic logging.

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

## Roadmap

- Audio-driven lip-sync and TTS integration
- Retargeting external animation clips across rigs
- `.vrm` support

## Credits

The demo character is
[Animated Human](https://opengameart.org/content/animated-human-low-poly) by
[Quaternius](https://quaternius.com/), released under CC0. See
[demo/public/models/MODEL_LICENSE.md](demo/public/models/MODEL_LICENSE.md).

## License

[MIT](LICENSE) © Jatin Rana
