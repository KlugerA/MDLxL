# Paint verification after Autoaim feedback

Date: 2 October 2026. Base: `9e9a41cc3aa7ac6dfda2277ba5c578ad556340f8` (0.16.0). Feature branch: `codex/citadel-native-paint`. Tracked `dist` rebuilt for Electron. No release version changed.

The first tester was rejected for lag and UV repacking. Prior automatic-atlas screenshots/test passes are historical evidence, not user acceptance. The current correction restores the original texture layout and adds the requested optional Autoaim source zoom.

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

Results: **120 Paint tests and 56 compatibility tests passed; production build and package check passed.** Coverage includes native rectangular pixels, complete material-layer preservation, every alpha value in portable PNG layers, deliberate UV rebaking, seam vertex/rig streams, atomic rejection, mask exclusion, brush projection, retirement provenance, and hit-face-only Autoaim scaling. Two obsolete automatic-preparation cases were removed with that mechanism; one local Autoaim regression was added. Compatibility results are recorded in `autoaim-compatibility.log`.

## Running Electron workflows

```powershell
$env:MDLXL_PLAYWRIGHT_MODULE = 'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:MDLXL_PAINT_FIXTURE = 'C:/Users/PC/Downloads/Footman (Original).mdx'
$env:MDLVIS_GAME_DATA = 'D:/Warcraft III'
node test/citadel-native-paint.electron.cjs
node test/citadel-autoaim.electron.cjs
node test/citadel-surfaces.electron.cjs
```

These create isolated profiles and output folders beneath ignored `out/citadel-audit`, use actual pointer/UI edits, and observe state without mutating application internals. Native file dialogs are supplied deterministic test destinations; model opening goes through the desktop Open workflow so relative BLP resolution has the real model directory.

- `workflow-1790936498866`: all 13 workflow checks passed after removing automatic preparation. Both views/default skin/native dimensions; destination and coat switching; untouched canonical hover; preview/commit exact raw raster and 3D screenshot equality; moving Detail without a trail; exact undo/redo; ordinary colour; native-library crop return; manual preparation; connected region; exact protected destination pixels; portable preset save/reopen; Warcraft archive parse; Use Paint + ordinary MDX/BLP save + desktop UI reopen. No renderer exceptions. Chromium translucent canvas readback tolerance is at most one RGB level; authoritative coat/compositor bytes and rendered 3D screenshots match exactly.
- `autoaim-1790936411704`: Autoaim defaults off and restores exact chosen zoom when disabled. Brush and Detail were exercised on shield and sword. In this camera pose, Brush zoom is 1.0 with Autoaim off, about 2.06 on the shield and 1.69 on the sword when on. Detail compensation is about 1.48 versus 1.22. Hover and committed pixels match; one ordinary paint Undo restores them. Assertions prove destination dimensions, bindings, UVs and geometry unchanged throughout hover, paint, undo and camera zoom. Moving between faces without changing the camera updates the compensation; flat texture painting stays literal. Captures were visually inspected with the original 256 texture layout intact. No renderer exceptions.
- `surfaces-1790936581726` (`autoaim-surfaces.log`): all 10 checks passed: flat/shared, seam, curved, stretched, collapsed, orbit, and explicit unique-mapping variants. No renderer exceptions. The synthetic fixture is generated in the test and never replaces a supplied source.

## Timing boundary

Baseline evidence: `out/citadel-audit/baseline2`. Renderer pointermove to two animation frames measured approximately 5–6 ms warm, p95 about 6.1 ms, max 12.5 ms; first colour stroke included a 177 ms long task.

The Autoaim test records 24 warm pointermove-to-two-rAF samples during actual texture brushing: approximately 4.9–6.9 ms, with no observed long tasks in that sample. The automatic atlas/rebake work is removed from hover and strokes. This is not physical input-to-photon latency or a controlled comparison against the user's experience; the next visible test determines acceptance. Earlier detail-test wall times included screenshots/settling and must not be reported as brush latency.

## Remaining acceptance boundaries

- User rejected the initial atlas tester; acceptance of this one visible correction is pending. Native Warcraft gameplay rendering was not exercised.
- Classic MDX800 only. Animated UV preparation, unsupported vertex streams, atlas capacity or undo-budget overflow produce explicit errors. Missing or differently laid-out native source recipes direct the user to the native library; no synthetic fallback is created.
- Deliberately requested independent paint mapping rebakes the working skin and may duplicate seam vertices while preserving position/normal/rig values and prior UV sets. Original file bytes stay unchanged and the editable preset retains them. BLP export uses the existing JPEG-backed encoder; exact coat-byte preservation applies to the editable preset, not lossy BLP compression.
- Autoaim adjusts source zoom only. It does not separate shared texels or create texture detail that the source lacks. Extreme closeups and unusual mappings still need user testing; pixel-perfect placement remains available with Autoaim off.
- Region selections are session tools, not saved preset selections. Ordinary colour painting on an authored shared mapping still shares those texels until preparation.
- No merge, release, offline upgrade or announcement performed. The open PR is the phase-one review checkpoint.
