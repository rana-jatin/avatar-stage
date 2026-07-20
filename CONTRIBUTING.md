# Contributing

Thanks for taking the time. Bug reports, rig-compatibility fixes, and new
procedural animations are all welcome.

## Getting set up

```bash
git clone https://github.com/rana-jatin/avatar-stage.git
cd avatar-stage
npm install
npm run dev
```

Node 20+ is expected; CI runs on Node 22.

## Scripts

| Command              | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Dashboard dev server with HMR                  |
| `npm test`           | Vitest suite (`npm run test:watch` to iterate) |
| `npm run typecheck`  | `tsc --noEmit` over `src`, `demo`, and `tests` |
| `npm run lint`       | ESLint with type-aware rules                   |
| `npm run format`     | Prettier write (`format:check` to verify)      |
| `npm run build`      | Compile the library to `dist/`                 |
| `npm run build:demo` | Build the dashboard to `dist-demo/`            |

CI runs lint, format check, typecheck, tests, and both builds. Run them locally
before pushing and there should be no surprises.

## Project layout

- `src/` is the **published library**. Everything public is re-exported from
  `src/index.ts`; if you add an export, add it there too.
- `demo/` is the dashboard app. It is **not** published — it imports the
  library through `../src/index` so the demo exercises the real public API.
- `tests/` holds Vitest suites for the pure logic. The viewer, UI, and entry
  point need a DOM and a GPU, so they are out of scope for unit tests; verify
  those by running the app.

Two conventions worth knowing:

- **Relative imports inside `src/` must use explicit `.js` extensions.** The
  library ships as ESM compiled by `tsc`; without the extension the output
  resolves under bundlers but throws `ERR_MODULE_NOT_FOUND` in native Node.
- **`three` is a peer dependency.** Don't import anything that would pull a
  second copy of it into a consumer's bundle.

## Touching procedural animations

`src/procAnim.ts` is a large file of hand-tuned keyframe tables. Two things
guard it:

- `tests/procAnim.test.ts` holds a **snapshot of every generated track**. A
  refactor must leave it untouched. If you intentionally re-tune a clip, update
  the snapshot in the same commit (`npx vitest -u`) and say so in the PR — a
  changed snapshot should always be a deliberate choice, never a surprise.
- `ATTEN` (`PI / 250`) is **not** a degrees-to-radians conversion despite what
  its old name suggested. It is an amplitude attenuation that every keyframe
  table is calibrated against. Changing it re-scales every animation at once.

New clips are added to the `GENERATORS` array. Declare the roles the clip needs
in `needs`; use `anyOf: true` if a partial match is still worth playing. Clips
whose bones are missing report themselves through `status` and the UI disables
them — no need to handle that yourself.

Keyframe tables are wrapped in `// prettier-ignore` where their alignment is
meaningful. Please keep it that way.

## Adding rig support

Add the bone-name aliases to `ROLE_ALIASES` in `src/armature.ts`, add a
signature to `RIG_SIGNATURES` if the family is identifiable from the head bone,
and add a fixture to `tests/helpers/rigs.ts` plus a case in
`tests/armature.test.ts`. The fixture is the important part — it's what keeps
the family working as detection evolves.

## Pull requests

- Branch off `main`.
- Keep commits focused; a mechanical refactor and a behavior change belong in
  separate commits.
- Describe what you verified. "Loaded an RPM avatar and played every procedural
  clip" is worth more than "should work".
- If you changed anything visual, a screenshot or clip helps a lot.

## Reporting bugs

Rig issues are much easier to fix with the model in hand. If you can't share
it, open the demo with `?debug`, reproduce, and paste the console output plus
the rig family and bone names the Armature panel reports.

## Releasing

Maintainers only:

```bash
npm version <patch|minor|major>
npm publish          # prepublishOnly runs the library build
git push --follow-tags
```

Then write the GitHub Release from the CHANGELOG entry.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
