# Avatar Animation Dashboard

A Vite + Three.js dashboard for rigged GLB avatars. It ships with a bundled
CC0 demo character, detects the skeleton across common rig families
(Mixamo, Character Creator, Ready Player Me, VRoid, Rigify, and a custom
numbered-bone rig), generates procedural body animations at runtime, and
exposes morph/expression/lip-sync controls for inspection.

## Features

- Interactive 3D viewer powered by `three` — load the bundled demo avatar,
  upload any `.glb`/`.gltf`, or drag-and-drop one onto the stage
- Automatic humanoid rig detection with per-role manual remapping
- Procedural animations generated for whatever bones the rig has (wave,
  dance, bhangra, clap, punch combo, jump twist, sneaky walk, thinking pose,
  and more)
- Idle behaviors: auto-blink, breathing, head sway
- Expression presets and a no-audio lip-sync viseme test (requires a model
  with ARKit blendshapes, e.g. a Ready Player Me export)
- Searchable blendshape (morph target) sliders

## Panels

- Upload: pick a GLB/glTF file (or drop one on the stage)
- Armature: skeleton summary plus a per-role bone remap to reassign which
  bone drives each humanoid role
- Animations: play any clips embedded in the GLB and stop the current one
- Procedural Animations: trigger rig-driven motions
- Expression presets: apply preset facial expressions
- Idle behaviors: toggle auto-blink, breathing, and head sway
- Camera: frame the head or the full body
- Lip-sync test: generate a simple viseme sequence from text
- Blendshape sliders: search, inspect, and reset morph targets

## Getting Started

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal. The bundled demo model
(`public/models/demo-avatar.glb`, CC0 by [Quaternius](https://quaternius.com/) —
see `public/models/MODEL_LICENSE.md`) loads automatically; upload your own
GLB to replace it.

## Scripts

- `npm run dev` - start the development server
- `npm run build` - create a production build
- `npm run preview` - preview the production build locally

## Notes

- The demo model has no morph targets, so the expression/lip-sync panels are
  inert until you load an ARKit-capable avatar (e.g. a Ready Player Me GLB).
- `node_modules/` and build output are ignored in version control.
