# OptimizeXL review evidence — 2026-09-28

This is an unmerged feature review build, not a published version. The primary checkout and installed application were not modified.

## Automated checks

- 90/90 focused tests passed: OptimizeXL operations and paired-save failures/races, existing model optimizer, preview presentation/compositing/capture, and the 56-case codec compatibility suite.
- The production Vite bundle built successfully. Its existing large-chunk advisory remains.
- Packaging verified 560 runtime/asset files and 55 Electron locale files, including the unmodified local Hive checker and its license.
- The packaged EXE passed the isolated Playwright/Electron workflow: launch popup, switch Simple/Advanced, synchronized camera orbit/zoom and preservation across candidate rebuilds, matching playback frames, actual Hive check, selected visibility repair and approval, wheel cycling of collision presets, sphere overlays present only during Sphereomancer, real nuclear reduction, and final two-file save. No page errors were recorded and the source file remained byte-identical.
- Source-path `git diff --check` passed. Generated bundles retain upstream shader text and are not hand-edited.

The broader exploratory run also encountered three existing failures outside this feature's changes: the binding byte-capacity assertion in `test/editor-commands.test.js`, and old source-string assertions in `test/uv-camera-preservation.test.js` and `test/uv-detached-window.test.js`. The corresponding unchanged binding source and fetched-HEAD camera/window code were inspected. This is not a claim that the full repository suite passes.

## Khorne model integration

The inputs were the saved `Khorne_Optimized_Review` flail and axe copies from the earlier model work. The original Downloads paths were no longer present. No user model was rewritten.

The integration script serializes/reopens each candidate and runs the bundled Hive checker after exact duplicate cleanup, exact animation cleanup, unused-data cleanup, the selected Death → Decay Flesh repair, rider collision spheres, and 40% nuclear reduction. Both models had **0 errors, 0 severe findings, 0 warnings and 0 unused notices** in the checked candidates.

| Model | Input bytes | Final candidate bytes | Polygons before nuclear | After nuclear |
| --- | ---: | ---: | ---: | ---: |
| Khorne flail | 241,750 | 224,540 | 3,408 | 2,668 |
| Khorne axe | 210,240 | 197,033 | 2,862 | 2,280 |

Exact cleanup produced **zero coordinate difference** at nine native-renderer pose samples per sequence. The repaired Death-end and Decay-Flesh-start poses also had zero coordinate difference. This finite sampling does not establish equivalence at every instant. Nuclear candidates deliberately change geometry and require the user's visual acceptance.

The flail irregularity scan found the original Stand-3 portrait/corpse visibility leaks, the four face parts reappearing in Decay Bone, and the Death → Decay Flesh discontinuity. The desktop test approved one selected visibility fix; it did not silently approve every proposal.

## Reproducing

```powershell
node --test test/optimizexl.test.js test/model-optimizer.test.js test/preview-presentation.test.js test/preview-blend-order.test.js test/game-preview-capture.test.js tests/*.test.js
node test/optimizexl-models.mjs path/to/flail.mdx path/to/axe.mdx
node node_modules/vite/bin/vite.js build
node scripts/package.mjs --out out/optimizexl-review
```

Set `MDLXL_PLAYWRIGHT_MODULE` to an installed Playwright module path, `MDLXL_OPTIMIZEXL_MODEL` to the flail review fixture, and optionally `MDLXL_OPTIMIZEXL_EXE` to a packaged EXE. Then run `node test/optimizexl.electron.cjs`. The specific desktop repair assertion expects the earlier flail fixture's geoset and sequence indices; the reusable model integration script accepts arbitrary input paths.

Local screenshots, the packaged interaction result and paired output copies are under `out/optimizexl-proof/`. The final review EXE is under `out/optimizexl-final-review/MDLxL-win32-x64/`. These generated outputs and user models are excluded from Git.

Warcraft in-game selection/animation, external Retera/MDLVis playback, and the user's visual acceptance have not been exercised. No public release or merge to online `main` has been performed.
