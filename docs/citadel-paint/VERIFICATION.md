# Citadel Paint verification — 3 October 2026

Evidence is under ignored `out/citadel-audit`. Harnesses use real Playwright
input in Electron. Fiber access reads state and profiles cache reuse; it does
not perform edits. Profiles and output files are isolated. The library harness
uses the real PaintTextureLibrary with a separate test root.

## Checks

- Paint unit/regression tests: **141 passed**, including bounded Blend strength,
  multi-geoset selection, brush shapes, color ramps, boundary-safe UV edits,
  floating-point camera cache reuse and exact triangle scanline parity.
- Compatibility plus WarmKeys defaults: **62 passed** (56 compatibility + 6
  shortcut checks).
- Vite production build: passed; existing large-chunk advisory remains.
- Package runtime whitelist and complete bundled dependency licenses: passed.
- Electron runs the rebuilt tracked dist. Source fixtures remain unchanged.

Current main at 1273cf3 (v0.16.1) is integrated. Incoming emitter/NormalsXL
source and release metadata were retained exactly; generated bundle conflicts
were resolved by rebuilding. The merged bundle passed the flow/studio checks
below. Six incoming ribbon tests and all 24 NormalsXL tests passed. The final
flow run includes the v0.16.1 baseline; the studio run predates that integration
and exercises the identical Paint persistence code.

## Running-app evidence

| Harness | Evidence folder | Exercised |
| --- | --- | --- |
| `test/citadel-flow.electron.cjs` | `flow-1790979936502` | Repeated stamps, one undo per stamp, shortcut rotation/mirror/borrow, Shift add/Ctrl subtract, actual Colorfy and outline pixels, picking while Colorfy is enabled, view-only preservation, nine shades, five brushes, 1px cursor, Blend strength keys, both wheel-zoom views, cutout shortcuts, copy/mirror/paste, Help isolation, fresh shaded basecoat |
| `test/citadel-studio.electron.cjs` | `studio-1790979552364` | Pixel-mask protection, selected-face UV moves and exact Undo/Redo, separation after UV moves with identical rendered appearance, Alt orbit, private UV-set reuse, portable project and ordinary MDX/BLP save/reopen, valid MDX800 ZIP export |
| `test/citadel-brushes.electron.cjs` | `brushes-1790979189905` | Exact brush color/eyedropper, eraser source/alpha preservation, protected texture painting and fill, face click/drag/Ctrl subtract, chosen gold basecoat |
| `test/citadel-surfaces.electron.cjs` | `surfaces-1790979182795` | Wrapped sampler, flat/shared, seam, curved, stretched/collapsed UV stamps; pressed preview equals committed pixels; orbit/repeat; explicit local independence preserves appearance and gives detail on compressed or point UVs; active texture follows destination |
| `test/citadel-library.electron.cjs` | `library-1790979199587` | Native 256px precision, exact imported PNG RGBA including hidden RGB/fractional alpha, ellipse cutout, Keep/reload in isolated personal library, Copy a patch, native Warcraft library |
| `test/citadel-model.electron.cjs` | `model-1790979183137` (Footman), `model-1790979276525` (Abomination Butcher) | Direct stamp/Undo/Redo, connected selection/isolation, exported geometry, UVs, rig streams, nodes, sequences and global sequences equal source |
| `test/citadel-reskin.electron.cjs` | `demo-1790979188839` | UI-only Footman study: gold armor, cyan blade, repeated chainmail patches, separate shield pixels and new shield image, portable save |

All listed runs have no renderer page errors. The Colorfy regression compares
actual rendered pixels (35,959 changed); Outlines changes 565 pixels in that
view. Button state alone was insufficient: the first screenshot review caught
textured layers drawing over Colorfy, which was corrected before this evidence.

The first new shortcut run also exposed global mesh Copy/Paste intercepting
Paint's clipboard. Paint now owns those shortcuts before the global dispatcher,
and the main clipboard buttons explicitly route into Paint.

Source SHA-256 values remain:
- Footman (Original).mdx: `7ee255776a6e757bd89766354df763201cd0519c488585b7c30151d5e313fc13`
- Abomination Butcher.mdx: `ec43376a04a6b83843baff82fb373956303d8a9bbcd118e67009b2374922b6cb`

## Saved study

`out/citadel-audit/demo-1790979188839/Gold-footman-study.mdlxlpaint` is editable;
`gold-footman-demo.png` shows the result. This is a quick workflow exercise,
not a polished asset or a novice completion-time claim. Its game-derived pixels
stay in ignored local output, never bundled/committed. Original files stay intact.

## Responsiveness measurements

Isolated Footman run at 1280x920, throttling off. Durations measure native input
handler entry to two requestAnimationFrame callbacks, not input-to-photon time.
These are individual same-machine runs, not a broad benchmark.

- Before cache correction, `flow-1790978536065`: hovering median 5.4 ms; first
  stamp 220 ms; repeated stamps 141-151 ms, with long tasks on each stamp.
- Profiling (`flow-1790978374707/stamp-profile.json`) identified UV scans and
  exact depth work. Cache inspection then proved stationary camera matrices
  differed only by floating-point roundoff, rebuilding the entire projection.
- Current isolated `flow-1790979095059`: 90 hover samples median 5.5 ms / p95
  5.7 ms with no long tasks; cached stamp median 25.7 ms / max 26.4 ms with no
  long task. The test asserts projection identity is retained across stamps.
- First uncached stamp remains about 211 ms. The second stamp, following the
  initial native texture rename, is about 137 ms. First-use/camera-change cost
  remains an explicit limitation; do not claim all interactions are under 30 ms.

Triangle scanline tests compare every texel, barycentric and gutter flag with
the previous rectangle scan across 105 geometries, four wrap modes and both
zero/padded coverage. Seam tests independently compare exact filter intervals.
No visibility approximation or stamp-quality reduction was introduced.

## Limits

Shared UVs still share paint until explicitly separated. Mixed/line-degenerate
mapping is not generally unwrapped; arbitrary linear-filter parity remains
unestablished. A complete Ghoul reskin, user acceptance, and native Warcraft
runtime playtest remain unexercised.

## Release cleanup and hotfix verification

- 217 focused Paint, compatibility, localization, shortcuts and selection tests passed.
- 72 particle tests passed. The portable runtime incorporates hotfix 809e427
  from `codex/fix-portable-particle-library`, including activeParticleSample.
  Package validation imports the standalone runtime and scanner without node_modules.
- `flow-1790983064958`: direct repeat stamps, Undo/Redo, brushes, palette,
  selection, visual aids, zoom, copy/mirror/paste and shaded base coat passed.
  Hover median 5.7 ms / p95 7.3 ms; first stamp 193.4 ms; warm stamp 29.6 ms.
- `edges-1790983083548`: normal off-model click made no change; R-stamp changed
  5,400 pixels inside the mask and zero outside. Off-model brush Undo, texture
  margin painting and polygon corner/close/Backspace feedback passed.
- `locales-1790983101802`: Paint, Stamp, help, cutout and protection dialogs
  rendered in all five languages without page errors. Physical-key shortcuts
  remain usable with non-Latin keyboard layouts. Screenshots were inspected.
- Grabthrough Electron checks confirmed Vertex starts enabled, Bones starts
  disabled and Movement has no toggle; hidden vertex selection/drawing passed.
- Both two-page English/Russian PDF guides were rendered and all four pages
  visually inspected; text extraction confirmed Cyrillic without replacement glyphs.

These checks exercise isolated copies and profiles. The original Footman and
Abomination model files remain unchanged. Packaged release and migration evidence
is recorded separately during deployment; user acceptance is still pending.

- `packaged-flow`: the actual 0.17.0 EXE passed the complete interaction flow,
  with no renderer errors and cached stamps at 26.6 ms median in this run.
- `packaged-particles`: app.getAppPath confirmed the portable resources/app.
  Warcraft and all four My work cards rendered. The catalog held 5,018 Warcraft
  entries, including 4,581 usable recipes; four drafts and five native recipes
  were read. A limited scanner run parsed four assets and produced nine recipes.
  Five known recipe-validation failures concerned a zero-duration global sequence,
  not missing modules; the packaging hotfix does not change asset compatibility.

## Reproduction

Build dist first. Set MDLXL_PLAYWRIGHT_MODULE to the installed Playwright package
and MDLXL_PAINT_FIXTURE to a Classic Footman MDX800. Use the configured Warcraft
data installation. Run the seven named citadel harnesses; for the second model
run, set the fixture to Abomination Butcher.mdx. Optional MDLXL_PAINT_PROFILE=1
saves a Chromium CPU profile during the flow harness's stamp sequence.
