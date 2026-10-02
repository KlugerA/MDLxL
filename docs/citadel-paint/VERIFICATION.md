# Phase-one Paint verification

Date: 2 October 2026. Base: `9e9a41cc3aa7ac6dfda2277ba5c578ad556340f8` (0.16.0). Feature branch: `codex/citadel-native-paint`. Tracked `dist` rebuilt for Electron. No release version changed.

## Inputs and preservation

- Supplied Classic fixture: `C:\Users\PC\Downloads\Footman (Original).mdx`, MDX800, five geosets. SHA-256 before and after: `7ee255776a6e757bd89766354df763201cd0519c488585b7c30151d5e313fc13`.
- Configured native installation: `D:\Warcraft III`. Source recipes, crop rectangles, inspected image dimensions and provenance hashes are in `src/paint-assets.js`; the cinematic Footman chainmail crop is `(32,149,72,72)` from `humancampaignfootman.dds`.
- Native models extracted for the read-only audit were MDX1800. Citadel's existing MDX800 gate was retained; no supplied model was converted or repaired to make a test pass.
- Source pictures, videos and extracted models are local ignored evidence only. No game pixels or supplied model binaries were added to Git.
- Asset retirement tests prove exact-path/exact-hash removal and survival of modified, renamed and personal files. The primary checkout and its personal texture folders remain untouched.

## Automated checks

```powershell
$files = rg --files test | Where-Object { $_ -match 'paint.*\.test\.js$' }
node --test $files
node --test tests/*.test.js
node node_modules/vite/bin/vite.js build
node scripts/package.mjs --check
```

Results: **121 Paint tests passed; 56 compatibility tests passed; build and package check passed.** Coverage includes native rectangular pixels, complete material-layer preservation, every alpha value in portable PNG layers, UV rebaking, seam vertex/rig streams, multiple image layers on one geoset, atomic rejection, single-step preparation/painting undo, mask exclusion, brush projection, and retirement provenance.

## Running Electron workflows

```powershell
$env:MDLXL_PLAYWRIGHT_MODULE = 'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:MDLXL_PAINT_FIXTURE = 'C:/Users/PC/Downloads/Footman (Original).mdx'
$env:MDLVIS_GAME_DATA = 'D:/Warcraft III'
node test/citadel-native-paint.electron.cjs
node test/citadel-detail.electron.cjs
node test/citadel-surfaces.electron.cjs
```

These create isolated profiles and output folders beneath ignored `out/citadel-audit`, use actual pointer/UI edits, and observe state without mutating application internals. Native file dialogs are supplied deterministic test destinations; model opening goes through the desktop Open workflow so relative BLP resolution has the real model directory.

- `workflow-1790934575501`: 13 workflow checks passed. Both views/default skin/native dimensions; destination and coat switching; untouched canonical hover; preview/commit exact raw raster and 3D screenshot equality; moving Detail without a trail; exact undo/redo; ordinary colour; native-library crop return; manual preparation; connected region; exact protected destination pixels; portable preset save/reopen; Warcraft archive parse; Use Paint + ordinary MDX/BLP save + desktop UI reopen. No renderer exceptions. Chromium's first translucent canvas readback differs by at most one RGB level; the authoritative coat/compositor bytes and rendered 3D screenshot match exactly.
- `detail-1790934291266`: Brush and Detail directly on the original shield at three camera distances, without manual surface preparation. Every preview matches committed coat pixels; each Undo restores the 256 source mapping. Automatic mapping transfers the original mask to 1024 and protects excluded texels. Captures were visually inspected: recognizable chainmail rows replace the reported broken-TV pattern. This proves the exercised camera range, not every possible view or model.
- `surfaces-1790934641693`: all 10 surface checks passed without renderer exceptions: flat/shared, seam, curved, stretched, collapsed, orbit, and explicit unique-mapping variants. The synthetic fixture is generated in the test and never replaces a supplied source. Curved/orbit captures were inspected in addition to preview/commit/undo assertions.

## Timing boundary

Baseline evidence: `out/citadel-audit/baseline2`. Renderer pointermove to two animation frames measured approximately 5–6 ms warm, p95 about 6.1 ms, max 12.5 ms; first colour stroke included a 177 ms long task.

The final native workflow records all samples in `result.json`: warm samples remain around 5–6 ms, with a 12.8 ms observed maximum and a 63 ms initial long task. This is not physical input-to-photon latency. The baseline used a 512 destination and one large view; the new current-skin workflow used native dimensions and two views, so these readings do not establish a controlled speedup. First imagery placement also performs atlas/rebake work; cold preparation is not included in the warm colour comparison. Detail-test wall times include screenshots/settling and must not be reported as brush latency.

## Remaining acceptance boundaries

- User is AFK; their visible acceptance is pending. Native Warcraft gameplay rendering was not exercised.
- Classic MDX800 only. Animated UV preparation, unsupported vertex streams, atlas capacity or undo-budget overflow produce explicit errors. Missing or differently laid-out native source recipes direct the user to the native library; no synthetic fallback is created.
- Independent paint mapping rebakes the working skin and may duplicate seam vertices while preserving position/normal/rig values and prior UV sets. Original file bytes stay unchanged and the editable preset retains them. BLP export uses the existing JPEG-backed encoder; exact coat-byte preservation applies to the editable preset, not lossy BLP compression.
- Automatic staging currently prepares eligible visible destinations at 1024. Extreme closeups and unusually dense/many-material models still need user testing; the explicit resolution control allows later refinement.
- Region selections are session tools, not saved preset selections. Ordinary colour painting on an authored shared mapping still shares those texels until preparation.
- No merge, release, offline upgrade or announcement performed. The open PR is the phase-one review checkpoint.
