# OptimizeXL review evidence — 2026-09-28

This is an unmerged feature review build, not a published version. The primary checkout and installed application were not modified.

## First review correction: viewport navigation

The initial camera test proved that the two camera states matched but did not prove that a drag changed either state. The user's review exposed the gap: OptimizeXL passed the unsupported drag mode `camera`, which mapped left-drag to no action. It now passes the existing `rotate` mode. OptimizeXL also supplies a local wheel-zoom preference, so an inherited main-editor sensitivity-adjustment mode cannot consume ordinary zoom input.

The strengthened Electron regression failed against the original build with `Left drag must actually rotate the camera`. It passes after the correction and explicitly verifies changed camera positions from a drag on either viewport, changed zoom, matching paired states, camera preservation through candidate updates, and the main editor's persisted wheel setting remaining unchanged. This correction does not alter models, reduction algorithms, repair visibility, sphere rendering or saving behavior.

The user accepted the viewport correction and authorized the next visible correction. Remaining review work is recorded here so it is not lost:

- The replacement Nuclear reducer below is ready for visual review; it is not yet user-accepted.
- Inspect the supplied Magos installation and modernize its familiar collision-sphere display. The shortcut resolves to `D:\WarcraftStuff\War3 Model Editor\War3ModelEditor\War3ModelEditor.exe`; Windows computer-use initialization currently fails with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`, including after a reset. No visual reference inspection is claimed.
- Restore the whole model when leaving irregularity/geoset inspection.
- Show which records Duplicate data and Unused data propose deleting.
- Add a clickable **I** explanation next to every Advanced option.
- Make top-right **Optimize New Copy** the only save action, available at any stage and saving approved changes. Retain exactly two new files and never overwrite originals.
- Put a green star inside each unused optimizer button, clearing it after approval or when no changes are possible/needed.

## Second review correction: Nuclear surface and texture preservation

The initial reducer prioritized shortest edges and allowed up to the model's full extent as a vertex displacement budget at maximum Simple strength. It could visibly deform the shield. Nuclear now uses the unmodified meshoptimizer 1.3.0 attribute-aware quadric simplifier, weighting surface shape, normalized normals and every UV channel. Retained vertex positions, authored normals, UVs and bone bindings remain exact. Explicit locks preserve bone boundaries and sharp edges; default seam protection also locks open borders. No vertex-update, sloppy or component-pruning mode is used.

Simple retains its 0.01%-step slider. Its combined error budget grows quadratically from 0 to 20%; Advanced exposes that budget instead of the old movement-distance setting. This percentage describes the upstream error metric, not a pixel-difference guarantee. Upstream can cross its approximate polygon target when one collapse removes several triangles; the adapter retries from the unchanged input with a higher target to honor OptimizeXL's lower bound.

Five new regressions cover surface-feature retention, secondary-UV distortion, normal interpolation, complete authored records and bone boundaries, and odd triangle targets. The packaged test exercises medium strength, full strength, restoring zero and then full strength again before approval/saving. The vendored module's SHA-256 is `C3098EE4CB4FC242B84F064C88898E76E44BF58B0E1F693507F323C08CDBB5ED`; its license and npm package integrity are shipped alongside it.

Enlarged flail comparisons were inspected in Stand from front and side, and at midpoints of Walk, Attack - 1 and Death. The original shield distortion is substantially reduced in these sampled views, with normal loss of detail still visible at maximum strength. This is finite visual evidence, not acceptance of every pose or view. User review remains the next gate. Other requested interface/sphere/visibility changes have not been bundled into this correction.

## Automated checks

- 95/95 focused tests passed: OptimizeXL operations, Nuclear quality/target regressions and paired-save failures/races, existing model optimizer, preview presentation/compositing/capture, and the 56-case codec compatibility suite.
- The production Vite bundle built successfully. Its existing large-chunk advisory remains.
- Packaging verified 563 runtime/asset files and 55 Electron locale files, including the unmodified local Hive checker, meshoptimizer module and their licenses.
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
node --test test/optimizexl-nuclear.test.js test/optimizexl.test.js test/model-optimizer.test.js test/preview-presentation.test.js test/preview-blend-order.test.js test/game-preview-capture.test.js tests/*.test.js
node test/optimizexl-models.mjs path/to/flail.mdx path/to/axe.mdx
node node_modules/vite/bin/vite.js build
node scripts/package.mjs --out out/optimizexl-nuclear-review
```

Set `MDLXL_PLAYWRIGHT_MODULE` to an installed Playwright module path, `MDLXL_OPTIMIZEXL_MODEL` to the flail review fixture, and optionally `MDLXL_OPTIMIZEXL_EXE` to a packaged EXE. Then run `node test/optimizexl.electron.cjs`. The specific desktop repair assertion expects the earlier flail fixture's geoset and sequence indices; the reusable model integration script accepts arbitrary input paths.

Local packaged screenshots, the interaction result and paired output copies are under `out/optimizexl-proof/`. Additional Nuclear pose/view screenshots are under `out/nuclear-visual/`. The Nuclear review EXE is under `out/optimizexl-nuclear-review/MDLxL-win32-x64/`. These generated outputs and user models are excluded from Git.

Warcraft in-game selection/animation, external Retera/MDLVis playback, and the user's visual acceptance have not been exercised. No public release or merge to online `main` has been performed.
