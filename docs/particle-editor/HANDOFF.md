# Particle Editor prototype handoff

Continue on `codex/particle-editor-prototype`, draft PR https://github.com/KlugerA/MDLxL/pull/60. The managed checkout is `C:\Users\PC\.codex\worktrees\particle-editor-prototype\MDLxL`. The base was `c62faa4299a0b44519f992cf3765da7623e72417` (v0.14.1). Keep this work isolated: no main merge, release, version bump or desktop installation has been authorized. The primary checkout has unrelated local changes.

The user is testing an isolated fixed snapshot while a further UX pass continues. Current tester, feedback, asset provenance and evidence are in [USER-FEEDBACK.md](USER-FEEDBACK.md); these supersede the checkpoint-9 status below. Keep their test window independent of source/dist rebuilds. This is a prototype interaction, not acceptance of every contract gate or Warcraft fidelity.

## Working path

Open Particle Editor from EMTR beside KEY/VIS or the existing Windows menu. Lab opens without a model. Choose a reviewed effect in the appearance-based library or an MDLxL original, edit in Clueless or Classic, save a personal preset, or preview and confirm one undoable placement into a model. Animated placement requires a user-chosen end. Existing model effects also open by double-click or the ingredient list. Checkpoint-9 evidence and limits are in [ACCEPTANCE.md](ACCEPTANCE.md); the literal original request is [CONTRACT.md](CONTRACT.md).

The prototype includes pinned size/spawn/aim/spread handles; life samples and native track gestures; independent inspection clocks and deterministic replay; four picture UV ranges and custom embedded pictures; ribbon paths/windows; original paired examples; repeated-instance inspection; source-model context; on-demand ingredient thumbnails and preview-only mute; explicit attachment/motion placement; portable presets; and native-close draft recovery. These share native models and the existing renderer/codec/document history.

## Ownership map

| Work | Owner |
|---|---|
| Lab/model ownership, transactions, recovery and editor orchestration | `app/ParticleEditor.jsx` |
| Native field gestures and scope/key/global-phase latching | `src/particle-bindings.js` |
| Recipe extraction, validation, minimal graph copy, timing and insertion | `src/particle-recipes.js` |
| Shared native runtime, frame lifecycle and authoring integration | `app/GamePreview.jsx` |
| Pinned war3-model 4.0.1 private-runtime compatibility, replay and picking | `app/particle-preview-adapter.js` |
| Direct handles and sweep tools | `app/ParticleStageTools.jsx`, `src/particle-handles.js`, `app/ParticleSweepTools.jsx`, `src/particle-sweep.js` |
| Ghost placement and temporary inspection | `app/ParticlePlacementStage.jsx`, `app/ParticleTestView.jsx`, `app/ParticleIngredients.jsx` |
| CASC index and exact-source dependency resolution | `electron/particle-library-worker.mjs`, `electron/particle-source.cjs` |
| Preset store, source metadata and revision-bound thumbnails | `electron/particle-library.cjs`, `app/ParticleThumbnailQueue.jsx` |
| Hash-bound observed appearance names | `src/particle-reviewed-names.json` |

Only the adapter touches private pinned renderer internals. Do not edit imported libraries. Preserve source bytes and canonical fields; do not repair models to make previews work. Live updates must verify the renderer owns the current model before applying changed parent references. Lab selections must not call the main model selection callback. Muting and demonstration motion live only in preview clones.

## Local verification

Run in the managed checkout. `node_modules` is currently a junction to the existing primary dependency tree; installing packages was unnecessary. Electron loads `dist`, so rebuild before claiming desktop parity.

```powershell
node --test test/particle-prototype.test.js test/particle-preview.test.js test/particle-sweep.test.js test/particle-library.test.js test/desktop-settings.test.js tests/*.test.js
node node_modules/vite/bin/vite.js build
$env:MDLXL_PLAYWRIGHT_MODULE = 'C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
node test/particle-prototype.electron.cjs
node test/particle-model-io.electron.cjs
node test/particle-parent.electron.cjs
node test/particle-lifecycle.electron.cjs
```

The desktop harnesses use private profiles and offscreen windows; they do not demonstrate user acceptance or actual Warcraft behavior. The main workflow requires the local source index. Recreate or incrementally resume it with:

```powershell
node scripts/index-particles.mjs --source 'D:/Warcraft III'
```

Current source inventory: 3,486 classic candidates, 3,485 parsed sources, 4,581 extracted recipes and 437 unavailable identities. Thirty-four names have observed native captures; 4,984 identities still need naming review. Extraction is not preview/insertion certification. The 99 real-source lifecycle captures are summarized in [LIFECYCLE.md](LIFECYCLE.md). Exact build/hash/count metadata is in [coverage-summary.json](coverage-summary.json).

To reopen the same visible tester when the user asks, use the existing isolated profile and the built worktree. Do not use `MDLVIS_HEADLESS=1` for a visible tester.

```powershell
$env:MDLXL_PROFILE = Join-Path $PWD 'out\particle-prototype\live-profile-1790802883740'
Remove-Item Env:MDLVIS_HEADLESS -ErrorAction SilentlyContinue
& .\node_modules\electron\dist\electron.exe .
```

Final checkpoint checks passed: 118 focused tests, production build, main Electron workflow, 34 reviewed captures, separate native save/reopen, and transformed-parent regression. The lifecycle harness also passed 99 samples.

Logs/captures are ignored under `out/particle-prototype`. `ingredients.png` shows the ingredient overlay; `review-0.png` through `review-4.png` cover the 34 reviewed effects; `lifecycle` contains the 99 source samples; `runtime.json` records the main desktop run. No Warcraft asset bytes are committed.

## Next refinement priorities

1. Preserve the tested prototype while iterating on visible user feedback, one visible change at a time. The user asked to retain an isolated branch until release polish.
2. Finish classic corpus compatibility. PE1 model-particle simulation/insertion is missing; bind-pose graphs, invalid globals and missing dependency cases remain explicitly unavailable. Popcorn/HD authoring is outside the classic contract. Keep those identities and reasons visible.
3. Verify renderer behavior in Warcraft before claiming fidelity: ribbon gravity, particle draw ordering, lighting/fog flags, nonuniform/reflected parent combinations, and native ModelSpace/atlas/team behavior. Existing editor captures and source references are not game proof.
4. Review effect names and broader source/group/lifecycle samples. Most entries still use neutral labels. Do not infer appearance from filenames or shared textures. Curated names must remain tied to exact hashes and actual sample times.
5. Decide and implement placement into a model without any animation clip. It currently stops with an explicit target-animation requirement; do not silently fabricate or retime unrelated animation data.
6. Finish the field-by-field keyboard/accessibility and unusual animated-field matrix. Preserve the compact default view, timeline/key ownership, native spline tangents and UI-mode equivalence.

The historical whole-source run had 1,048 passes, 17 failures and two skips out of 1,067. Sixteen failures reproduced on the untouched base; one CPU-bound keyframe test was stopped. Do not call the full suite green. Focused current checks are listed in ACCEPTANCE.md. Performance remained about 50 FPS in the controlled 800-particle fixture; see [PERFORMANCE.md](PERFORMANCE.md), including its retrospective baseline and scanout limits.
