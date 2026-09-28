# OptimizeXL review evidence — 2026-09-28

This is an unmerged feature review build, not a published version. The primary checkout and installed application were not modified.

## First review correction: viewport navigation

The initial camera test proved that the two camera states matched but did not prove that a drag changed either state. The user's review exposed the gap: OptimizeXL passed the unsupported drag mode `camera`, which mapped left-drag to no action. It now passes the existing `rotate` mode. OptimizeXL also supplies a local wheel-zoom preference, so an inherited main-editor sensitivity-adjustment mode cannot consume ordinary zoom input.

The strengthened Electron regression failed against the original build with `Left drag must actually rotate the camera`. It passes after the correction and explicitly verifies changed camera positions from a drag on either viewport, changed zoom, matching paired states, camera preservation through candidate updates, and the main editor's persisted wheel setting remaining unchanged. This correction does not alter models, reduction algorithms, repair visibility, sphere rendering or saving behavior.

The user accepted viewport navigation, Nuclear, inspection restoration and Optimize New Copy, then requested geoset exclusions and the next addition together. Remaining review work is recorded here so it is not lost:

- Geoset exclusions and green stage stars are ready for the next user visual check.
- Inspect the supplied Magos installation and modernize its familiar collision-sphere display. The shortcut resolves to `D:\WarcraftStuff\War3 Model Editor\War3ModelEditor\War3ModelEditor.exe`; Windows computer-use initialization currently fails with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`, including after a reset. No visual reference inspection is claimed.
- Show which records Duplicate data and Unused data propose deleting.
- Add a clickable **I** explanation next to every Advanced option.

## Second review correction: Nuclear surface and texture preservation

The initial reducer prioritized shortest edges and allowed up to the model's full extent as a vertex displacement budget at maximum Simple strength. It could visibly deform the shield. Nuclear now uses the unmodified meshoptimizer 1.3.0 attribute-aware quadric simplifier, weighting surface shape, normalized normals and every UV channel. Retained vertex positions, authored normals, UVs and bone bindings remain exact. Explicit locks preserve bone boundaries and sharp edges; default seam protection also locks open borders. No vertex-update, sloppy or component-pruning mode is used.

Simple retains its 0.01%-step slider. Its combined error budget grows quadratically from 0 to 20%; Advanced exposes that budget instead of the old movement-distance setting. This percentage describes the upstream error metric, not a pixel-difference guarantee. Upstream can cross its approximate polygon target when one collapse removes several triangles; the adapter retries from the unchanged input with a higher target to honor OptimizeXL's lower bound.

Five new regressions cover surface-feature retention, secondary-UV distortion, normal interpolation, complete authored records and bone boundaries, and odd triangle targets. The packaged test exercises medium strength, full strength, restoring zero and then full strength again before approval/saving. The vendored module's SHA-256 is `C3098EE4CB4FC242B84F064C88898E76E44BF58B0E1F693507F323C08CDBB5ED`; its license and npm package integrity are shipped alongside it.

Enlarged flail comparisons were inspected in Stand from front and side, and at midpoints of Walk, Attack - 1 and Death. The original shield distortion is substantially reduced in these sampled views, with normal loss of detail still visible at maximum strength. This is finite visual evidence, not acceptance of every pose or view. The user accepted this iteration and authorized continuing with the next issue.

## Third review correction: leaving repair inspection

The reported partial-model view was reproduced in the previous Nuclear review EXE. Selecting `decay:37` moved both previews from Stand/frame 2000 into Decay Bone/frame 176667. Clicking Duplicate data left that temporary animation selected, so the body remained hidden by its authored decay visibility. The regression failed with `Leaving a finding must restore the previous whole-model animation` (`10` instead of `1`). No stuck geoset filter was present in OptimizeXL.

The correction is confined to OptimizeXL's inspection state. The first finding saves a return animation/frame, which persists through multiple finding selections. Leaving via stage buttons or Next stage, clearing a finding, Skip fix and Approve restore that return point. Back reopens the undone finding and establishes a new return point. The camera remains untouched and ordinary stage changes preserve manually selected animations. No model visibility, geometry, animation keys or renderer behavior was changed by this patch.

The focused Electron regression passes against the rebuilt source bundle and packaged EXE. It checks exits to all six other stages, multiple findings, clearing, skipping, approving, Back, exact restored native-renderer sequence/frame on both sides, matching camera position/target/zoom, preserved speed/loop settings, and unchanged source bytes. Screenshots confirm that the complete model returns. The existing full packaged workflow also passes. The user accepted this correction and authorized continuing.

## Fourth review correction: Optimize New Copy

The only save button is now **Optimize New Copy** in the top-right header. It is enabled at every stage except while a save is already in progress, and remains the same action after the last stage. The old final-stage Save Before + After button was removed. The existing approved-snapshot API and exclusive paired writer were reused unchanged; no algorithm, model edit or new save route was introduced.

The save-specific Electron check passes against both the rebuilt source bundle and packaged EXE. It verifies the button in all seven stages and saves through the real IPC/writer: no approvals, approved spheres with unapproved Nuclear visible, approved Nuclear, repeated saves, and a save after Back undoes Nuclear approval. Saved bytes match only the accepted state, and the NUCLEAR filename suffix appears only while Nuclear is approved. Each of five saves creates exactly two new files (ten total), preserving two pre-existing output files and every earlier new pair. Cancellation creates no files, and saving neither approves the visible proposal nor advances the stage. The source remains byte-identical; no page errors occurred.

The full packaged workflow and inspection-restoration regression also passed in that package. Header placement and the single save action were visually inspected in both an active stage and the final state. The user accepted this correction.

## Fifth review addition: geoset exclusions and green stars

The reduction stages now share an exclusion set using the Vertices editor's existing selection helper, checkbox grid styles and column order. Single checks, Shift ranges, All, Clear and Invert work without changing preview visibility. Hover uses the existing posed-geoset picker and highlight renderer, with the Appearance color, type and hover-source settings. Both previews receive the same hovered geoset. The box is compact and scrolls its own rows; it is absent from repairs, spheres and the completed state.

Duplicate and unused vertex cleanup and Nuclear skip excluded geometry. Equivalent-bone merging retains its rig dependencies. Animation reduction also retains the excluded geoset's bones/ancestors, GEOA, material and texture-animation tracks, including shared dependencies. Exact resource cleanup can still renumber references without changing their targets. Exclusions persist across reduction stages; Back restores those captured by an undone approval. Nuclear does not increase reduction pressure on other geosets to compensate for exclusions.

Green stage stars clear after approval or a verified no-change result at reviewed settings. Zero Nuclear strength and disabling all unused-data options are not treated as completed work. Skip keeps pending work marked. Changed exclusions or accepted bytes invalidate stale no-change results, and undo reopens pending work.

Five regressions verify excluded geometry, protected equivalent bones, shared animation dependencies, unchanged Nuclear pressure on eligible geometry, and approval/no-op/skip/undo star state. The Electron interaction test uses the actual flail in both native previews: checkbox/range selection, All/Clear/Invert, preserved excluded records, remaining reductions elsewhere, persistent selection, stage-only visibility, approval/skip/Back and stars. It projects native animated matrices through the existing picker and checks real pointer hits from both views. A custom magenta fill Appearance produced matching colored overlay pixels in both previews. Source bytes stayed unchanged. Screenshots were inspected with the compact picker and ordinary controls visible.

### Standalone save validation

C: ran out of space while packaging, so the review was built on D: without deleting earlier builds. That exposed an existing OptimizeXL save dependency bug: Electron main dynamically imported the source codec, which could find `war3-model` only through the development checkout's ancestor `node_modules`. The D: copy reproduced `ERR_MODULE_NOT_FOUND` during saving. The unchanged validation is now bundled with its codec dependencies by the production build; package verification loads that bundle. It still reopens both files and rejects malformed/unsupported data. Two bundle tests check this directly, and the complete workflow's real two-file save passes outside the development tree. The exclusive paired writer and save behavior were not changed.

The UI test originally read stale React fiber props and could see a previous completed candidate. It now reads the preview's current props reference and waits for the excluded geometry to reach the renderer. An inspection assertion also encountered approximately 1e-12 camera-coordinate rounding; its tolerance now matches the existing camera-motion test (1e-8). These were test-observation issues, not model or camera adjustments.

## Automated checks

- 102/102 focused tests passed: OptimizeXL operations, geoset exclusions, stage state, bundled validation, Nuclear quality/target regressions and paired-save failures/races, existing model optimizer, preview presentation/compositing/capture, and the 56-case codec compatibility suite.
- The production Vite bundle built successfully. Its existing large-chunk advisory remains.
- Packaging verified 566 runtime/asset files and 55 Electron locale files, including the portable save validator, unmodified local Hive checker, meshoptimizer module and their licenses.
- The packaged EXE passed the isolated Playwright/Electron workflow: launch popup, switch Simple/Advanced, synchronized camera orbit/zoom and preservation across candidate rebuilds, matching playback frames, actual Hive check, selected visibility repair and approval, wheel cycling of collision presets, sphere overlays present only during Sphereomancer, real nuclear reduction, and final two-file save. No page errors were recorded and the source file remained byte-identical.
- Source-path `git diff --check` passed. Generated bundles retain upstream shader text and are not hand-edited.

The broader exploratory run also encountered three existing failures outside this feature's changes: the binding byte-capacity assertion in `test/editor-commands.test.js`, and old source-string assertions in `test/uv-camera-preservation.test.js` and `test/uv-detached-window.test.js`. The corresponding unchanged binding source and fetched-HEAD camera/window code were inspected. This is not a claim that the full repository suite passes.

## Khorne model integration

The inputs were the saved `Khorne_Optimized_Review` flail and axe copies from the earlier model work. The original Downloads paths were no longer present. No user model was rewritten.

The integration script serializes/reopens each candidate and runs the bundled Hive checker after exact duplicate cleanup, exact animation cleanup, unused-data cleanup, the selected Death → Decay Flesh repair, rider collision spheres, and 40% nuclear reduction. Both models had **0 errors, 0 severe findings, 0 warnings and 0 unused notices** in the checked candidates.

| Model | Input bytes | Final candidate bytes | Polygons before nuclear | After nuclear |
| --- | ---: | ---: | ---: | ---: |
| Khorne flail | 241,750 | 238,538 | 3,408 | 3,292 |
| Khorne axe | 210,240 | 208,139 | 2,862 | 2,778 |

At 100% Simple Nuclear strength, generated independently from the same pre-Nuclear baseline, the flail reaches **2,946 triangles, saving 10,791 bytes (10.54 KB)**; the axe reaches **2,578 triangles, saving 6,753 bytes (6.59 KB)**. Both maximum-strength candidates also have zero Hive errors, severe findings, warnings and unused notices. Nuclear savings here are for that stage alone. These already optimized models have limited remaining reducible detail under the enabled protections.

Exact cleanup produced **zero coordinate difference** at nine native-renderer pose samples per sequence. The repaired Death-end and Decay-Flesh-start poses also had zero coordinate difference. For both 40% and 100% Nuclear candidates, all retained records matched authored attributes/bindings, and their native-renderer positions had **zero coordinate difference** across nine samples in every sequence. Removed vertices and changed triangle surfaces are intentionally excluded from that retained-vertex comparison. This finite sampling does not establish equivalence at every instant. Nuclear candidates deliberately change geometry and require the user's visual acceptance.

The flail irregularity scan found the original Stand-3 portrait/corpse visibility leaks, the four face parts reappearing in Decay Bone, and the Death → Decay Flesh discontinuity. The desktop test approved one selected visibility fix; it did not silently approve every proposal.

## Reproducing

```powershell
node --test test/optimizexl-exclusions.test.js test/optimizexl-validation.test.js test/optimizexl-nuclear.test.js test/optimizexl.test.js test/model-optimizer.test.js test/preview-presentation.test.js test/preview-blend-order.test.js test/game-preview-capture.test.js tests/*.test.js
node test/optimizexl-models.mjs path/to/flail.mdx path/to/axe.mdx
node node_modules/vite/bin/vite.js build
node scripts/package.mjs --out out/optimizexl-save-review
```

Set `MDLXL_PLAYWRIGHT_MODULE` to an installed Playwright module path, `MDLXL_OPTIMIZEXL_MODEL` to the flail review fixture, and optionally `MDLXL_OPTIMIZEXL_EXE` to a packaged EXE. Then run `node test/optimizexl.electron.cjs`. The specific desktop repair assertion expects the earlier flail fixture's geoset and sequence indices; the reusable model integration script accepts arbitrary input paths.

Run `node test/optimizexl-inspection.electron.cjs` with the same environment for the inspection-exit regression. It also expects the flail review fixture. Its screenshots and result are in `out/optimizexl-inspection-proof/`; `regression-before.png` captures the previous EXE's stuck decay view. That iteration's review package is `out/optimizexl-inspection-review/MDLxL-win32-x64/`.

Run `node test/optimizexl-save.electron.cjs` with the same environment for approved-only, any-stage saving. Its screenshots, output pairs and result are under `out/optimizexl-save-proof/` by default.

Run `node test/optimizexl-geosets.electron.cjs` for exclusions, shared Appearance hover and stage stars. Its default proof folder is `out/optimizexl-geosets-proof/`. All four desktop scripts accept `MDLXL_OPTIMIZEXL_PROOF_ROOT` to put isolated profiles and evidence on another drive.

The current standalone review package is `D:\MDLxL-Reviews\OptimizeXL-geosets-20260928\portable-review\MDLxL-win32-x64\`. Current packaged screenshots/results are under that review root's `portable-proofs` folder. This location deliberately has no development dependency tree. Earlier generated outputs remain in place.

Local packaged screenshots, the interaction result and paired output copies are under `out/optimizexl-proof/`. Additional Nuclear pose/view screenshots are under `out/nuclear-visual/`. The Nuclear review EXE is under `out/optimizexl-nuclear-review/MDLxL-win32-x64/`. These generated outputs and user models are excluded from Git.

Warcraft in-game selection/animation, external Retera/MDLVis playback, and the user's visual acceptance have not been exercised. No public release or merge to online `main` has been performed.
