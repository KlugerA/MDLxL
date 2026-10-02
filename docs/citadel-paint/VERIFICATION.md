# Citadel Paint remake verification

All local evidence lives under ignored `out/citadel-audit`. UI operations use
real Playwright input in Electron. Fiber access observes state; it does not
perform edits. Profiles and save outputs are isolated. The library harness uses
the real `PaintTextureLibrary` with a fresh test root, never the user's shelf.

## Current checks

- `node --test` on Paint test files: **127 passed** (two obsolete Autoaim tests
  retired; new borrow, selection-space, spatial stamp-fidelity and seam parity
  regressions included).
- `node --test tests/*.test.js`: **56 passed**.
- `node scripts/package.mjs --check`: runtime whitelist and bundled licenses
  verified.
- `node node_modules/vite/bin/vite.js build`: passed; existing large-chunk
  advisory remains. Electron runs rebuilt tracked `dist`.

## Running-app evidence

| Harness | Latest evidence folder | Exercised |
| --- | --- | --- |
| `test/citadel-studio.electron.cjs` | `studio-1790946649919` | Five starters, 512/native dimensions, held stamp, rotation/size, exact preview/Apply/undo/redo/Cancel, red texture borrowing, geoset/connected selection, isolate, independent pixels with identical before/after model render, Blend, project/ZIP/ordinary MDX save and reopen |
| `test/citadel-library.electron.cjs` | `library-1790946661046` | Native-size precision, exact RGBA PNG import, ellipse cutout, Keep to custom folder, lossless shelf reload, Copy a patch, native Warcraft library crop |
| `test/citadel-brushes.electron.cjs` | `brushes-1790946669002` | Exact color brush and eyedropper, erasing without altering original/alpha mask, undo, texture-region clipping, face click/drag/Shift subtract, opaque gold base coat |
| `test/citadel-surfaces.electron.cjs` | `surfaces-1790946674275` | Flat/shared, seam, curved, stretched and collapsed UV preview/Apply/undo; orbit and repeat; independent shared panel with unchanged rendered skin |

All four listed runs have no renderer page errors and include the cleanup of
unreachable old controls and the obsolete Autoaim helper. Repeat affected runs
if further edits are made before handoff. PNG import is tested with nonzero hidden RGB and
fractional alpha, so byte equality is stronger than screenshot equality.

The full studio save flow verifies exported MDX800 parses, ordinary Save As
writes portable BLP files, and native file-open reopens those textures. The
original supplied Footman bytes remain unchanged, SHA-256:
`7ee255776a6e757bd89766354df763201cd0519c488585b7c30151d5e313fc13`.

## Performance measurements

Same isolated Footman studio sequence at 1280x920, background throttling off:

- Before seam/depth optimization: `studio-1790944446776`, one 175 ms cold
  long task in the paint phase. Warm brush/stamp event-to-two-rAF samples mostly
  5-7 ms; one 44 ms brush sample.
- Scanline seam clipping: `studio-1790945165098`, cold long task 119 ms.
- Smaller exact-depth bins: `studio-1790945694201`, cold long task 97 ms.
- CPU profiles are saved beside these runs when `MDLXL_PAINT_PROFILE=1`.
  The seam function's sampled self time fell from about 54 to 18 ms; exact
  depth from about 60 to 30 ms. These are individual same-machine runs, not
  a broad benchmark or input-to-photon measurements. Cold pauses still exist.

The seam parity test compares every returned texel and interval against a
rectangle/slab reference over diagonal, horizontal, vertical, collapsed and
repeated coordinates. Smaller depth bins do not approximate visibility.

## Evidence limits

Preview equality does not mean a stretched/collapsed mapping can retain a rich
source image. Those synthetic cases validate coverage and persistence only.
The independently selected Footman shield's chainmail preview is captured as
`07-independent-shield-preview.png`; broad unrestricted stamps can still share
pixels elsewhere on authored mirrored UVs. No claim of arbitrary automatic UV
repair, finished Ghoul reskin, user acceptance, or native Warcraft playtest.
New UI text localization is not yet complete.

## Reproduction

Set `MDLXL_PLAYWRIGHT_MODULE` to the installed Playwright package,
`MDLXL_PAINT_FIXTURE` to the unchanged Classic Footman MDX800, and
`MDLVIS_GAME_DATA` to the configured Warcraft installation. Run the four
`test/citadel-*.electron.cjs` harnesses named above after building dist.
Do not run superseded historical selectors or count old screenshots as proof
of the current editor.
