# Smurf Animation Dashboard

A Vite + Three.js dashboard dedicated to the smurf avatar (`Smur_male6.glb`). It
loads the smurf, runs procedurally generated body animations and facial idle
behaviors, and exposes morph/expression/lip-sync controls for inspection.

## Features

- Interactive 3D smurf viewer powered by `three`
- Procedural animations tuned for the smurf rig (wave, dance, bhangra, clap,
  punch combo, jump twist, sneaky walk, thinking pose, and more)
- Idle behaviors: auto-blink, breathing, head sway
- Expression presets and a no-audio lip-sync viseme test
- Searchable blendshape (morph target) sliders

## Panels

- Armature: skeleton summary plus a per-role bone remap to reassign which smurf
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

Open the local Vite URL shown in the terminal. The smurf model
(`Smur_male6.glb`, one directory above the dashboard) loads automatically.

## Scripts

- `npm run dev` - start the development server
- `npm run build` - create a production build
- `npm run preview` - preview the production build locally

## Notes

- The app expects the smurf model at `../Smur_male6.glb` relative to the
  dashboard folder.
- `node_modules/` and build output are ignored in version control.
