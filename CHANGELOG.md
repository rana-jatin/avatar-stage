# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-20

First public release.

### Added

- Humanoid rig detection across Mixamo, Character Creator 4, Ready Player Me,
  VRoid, and Rigify, plus hierarchy and keyword fallbacks for unknown rigs and
  a dedicated map for numbered (`Bone.001`) skeletons.
- 15 procedural animation clips generated at runtime and gated on the bones
  each one needs, so partial rigs degrade instead of failing.
- ARKit blendshape indexing with alias mapping, eight expression presets with
  eased tweening, and text-to-viseme lip-sync.
- Idle behaviors: auto-blink, breathing, and head sway.
- `createViewer` with GLB loading from a URL or `ArrayBuffer`, automatic scale
  and ground normalization, camera framing helpers, and `dispose()` teardown.
- Dashboard demo app with upload and drag-and-drop, bundled with a CC0 model.
- Published as an ESM library with TypeScript declarations; `three` is a peer
  dependency.

[Unreleased]: https://github.com/rana-jatin/avatar-stage/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/rana-jatin/avatar-stage/releases/tag/v0.1.0
