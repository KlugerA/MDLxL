# Particle Editor prototype — isolated, unmerged

Contract: [CONTRACT.md](CONTRACT.md). Prototype for later 5.6 refinement; no merge or release without new explicit authorization.

Start 2026-09-30: weekly usage 93%. User allocates 40 percentage points total: approximately 7 before their reset, at most 33 afterward. Counter is rounded and account-wide. Check usage and push resumable checkpoints before limits.
Branch/worktree: codex/particle-editor-prototype at C:/Users/PC/.codex/worktrees/particle-editor-prototype/MDLxL.
Base c62faa4299a0b44519f992cf3765da7623e72417, v0.14.1. Historical contract base d492b5c, v0.14.0. Primary checkout is detached/dirty and untouched. Existing dependencies are linked; war3-model remains 4.0.1.

## Audit and evidence

- ParticleEditor.jsx / particle-editing.js own PE2 editing. GamePreview.jsx reconstructs native resources on model/revision changes; use a scoped live adapter.
- EditorDocument.apply owns validation, undo deltas, rollback, codec preservation. Independent Lab document; shared Fields.jsx unchanged.
- importGeosets is the known-good reference remapping pattern, but effect import must not transplant geometry or unrelated bones.
- game-data.cjs found D:/Warcraft III, build 3.0.0.24268, build key 3a9d8f26806936764d2d9ad526a65e04.
- Extended existing CascBridge.cs texture enumerator to support @models. Real read-only enumeration returned 14,984 model assets across namespaces. Inventory is local profile/particles/source-inventory.json. This is not a classic coverage/completion claim.
- Native PE2 props are referenced, permitting live parameter updates. Alive particles retain birth velocity/gravity/lifetime, so authoring replay differs from natural playback.
- Baseline compatibility suite: 56/56 passed. GUI, extraction completeness, performance and Warcraft acceptance not yet proven.
- Source assets stay local under ignored profile paths; do not upload game bytes.

## Remaining gates

1. Canonical typed recipe/dependency graph and gesture adapter; independent recoverable Lab and Classic/Clueless.
2. CASC recipes in gallery, working-copy edit, preset save/reopen, remapped placement/reopen.
3. Bulk manifest, naming/duplicates, direct stage/life tools, linked/unlinked deterministic playback, bounded ribbon sweep.
4. Preservation fixtures, current suites/build, default/small view captures, measured latency, A01–A29 results, pushed attached draft PR. Game validation is unverified unless actually run.

Every intermediate subset must remain labeled. Track implemented/tested, implemented/unverified and missing separately.

## Checkpoint 1
Implemented: typed canonical recipes, dependency graph copy, preset store with atomic prior copies, cancellable/resumable worker scan, real local CASC run, Classic/Clueless workspace, independent Lab recovery, six sliders, initial stage and life controls, shared live preview update, deterministic replay seed, basic remapping placement.
Verified: 56 compatibility + 8 new unit tests; Vite build; off-screen Electron starter has live particles, slider enables one undo path, saving Prototype test sparks succeeds without JS page errors. Screenshots/logs in out/particle-prototype. Large source suite was started; results pending.
Usage checkpoint: 96% used (about 3 points since start).
NOT complete: gallery thumbnail batch and naming review, alpha-aware owner picking/double-click, full direct aim/axis-aware gestures, preview placement ghost, matching-version-only insertion, event-exact deterministic clocks/replay, independent FX clock, bounded ribbon editing/sweep, full native-field binding coverage, portability for custom picture bytes, malformed input depth precheck, source-family compatibility, measured latency/FPS, Warcraft validation.
Initial scan: 3,486 candidates; 3,485 parsed; 3,830 recipes; 342 recipe/parse exceptions, 57 dependency misses. Source PE2 3,777; ribbons 357; PE1 67; Popcorn 88. All are inventoried, but failures need recovery and unsupported identities need gallery treatment. Zero-duration global rejection was corrected after this scan; rescan required.
Do not interpret extractionComplete as preview or insertion completion. No user model fixture or primary checkout was modified.

## Checkpoint 2 — 2026-09-30, before user reset

PR: https://github.com/KlugerA/MDLxL/pull/60 (draft, unmerged). Online main does not contain this prototype. Version remains 0.14.1 because this is unreleased work.
Usage counter reached 100% from 93%; approximately 7 of the allocated 40 percentage points have been consumed. After the user applies the reset, at most approximately 33 points remain. The counter is rounded and shared by the account.

Implemented and exercised:
- Real effect thumbnails rendered through the pinned native renderer and cached locally. Friendly generated names remain explicitly unreviewed.
- CASC Flame Strike embers opened in Lab and placed on a visible synthetic target model. Target format is retained after cross-version compatibility serialization.
- Linked preview speed corrected to the existing percent-based playback API: 0.5x passes 50.
- Visible SVG size proxy (shared resource-editor CSS had hidden it). Actual mouse resize pins a sample, one undo restores its original size, and Escape cancels without closing the editor.
- Preset saving retains the independent Lab undo history. Read-only New disabled.
- Typed input rejects float overflow and checks excessive nesting before JSON reviver recursion.
- Starter picture uses the existing MDLxL_Forge generated-asset sidecar path convention.

Verification:
- 66/66 targeted and current compatibility tests pass (10 particle prototype + 56 compatibility).
- Vite production build passes; tracked dist rebuilt. No package, desktop installation, or release claim.
- Off-screen Electron smoke test: native starter particles visible; scalar and stage resize; save personal preset; actual thumbnail gallery; load local CASC effect; place on loaded synthetic model. No JS page errors. Evidence: out/particle-prototype/{starter,edited,library,casc-effect,placed-effect}.png, runtime.json and runtime.log.
- Historical source suite: 1067 tests reported, 1048 pass, 17 fail, 2 skipped. Sixteen completed assertion failures reproduced against an untouched archive of base c62faa4 (111 focused baseline tests: 95 pass, 16 fail). The remaining keyframe-timeline test hung and its exact test process was stopped; this is not a passing full-suite claim.
- Schema-2 CASC rescan completed: 3486 classic candidate assets, 3485 parsed, 3830 recipes, 342 explicit exceptions, 57 missing dependencies, 65 unsupported recipe entries, 118 exact duplicate mappings. Zero-duration globals are retained by graph extraction but still rejected by native model validation; they are not silently repaired. Bind-pose graph cases, PE1 external simulation and Popcorn remain compatibility limitations.
- Source bytes remain in ignored local cache. Only coverage metadata is checked in.

Next work, still required by contract:
1. Complete stable axis-aware spawn/spread and direct aim, alpha-aware visible sample ownership/double-click, life controls as one gesture, actual placement ghost and cancel proof.
2. Deterministic fixed-step linked playback including global event boundaries, marked independent FX clock, coherent authoring resimulation, bounded ribbon sweep fitting. Current seeded seek is a starting point only.
3. Full native binding metadata and Picture grid/range controls; unsupported source identities visible in gallery without dropped data; corpus compatibility and dependency resolution.
4. Personal preset import/export/duplicate/tags and portable custom picture bytes; stale thumbnail invalidation; deterministic appearance/name review and useful categories.
5. Actual model-file save/reopen UI path, recovery/restart test, smaller viewport captures, measured latency/FPS and hardware record, targeted fixtures listed by contract. Warcraft in-game validation remains unverified.

Do not declare the goal or contract complete from this checkpoint. All A01-A29 remain subject to the evidence table below.

| Gate | Current evidence / remaining requirement |
|---|---|
| A01 | Starter editable and saved; no-model/restart/reopen end-to-end still needs proof. |
| A02 | Lab is independent; source untouched by copy and scalar unit tests. Full UI canonical comparison pending. |
| A03 | Canonical typed preservation unit tests pass; actual mode-switch deep comparison pending. |
| A04 | Populated 1400x920 capture has six primary controls and approximately 74% stage width. Smaller reference check pending. |
| A05 | Slider interaction and transaction unit test pass; continuous feedback latency unmeasured. |
| A06 | Real mouse pinned resize, single undo and Escape pass. Moving/dead sample and alpha picking pending. |
| A07 | Initial guides/handles present; parent, axis and broad-angle matrix incomplete. |
| A08 | Drag displacement is latched; animated-parent stationary-pointer runtime proof pending. |
| A09 | Native life samples present; stage gesture/color/opacity and endpoint cases incomplete. |
| A10 | Key scope latching and spline tangent unit tests pass; complete live runtime proof pending. |
| A11 | Percent playback fixed; matched-time deterministic tolerance not yet established. |
| A12 | Independent clocks not implemented. |
| A13 | Seeded seek exists; event-exact loops and global boundaries incomplete. |
| A14 | Ribbon data extraction exists; sweep fitting tools not implemented. |
| A15 | Existing selected emitter/list opens; alpha-aware double-click/overlap picker missing. |
| A16 | Confirmation visible and model undo unit proof pass; visual ghost and UI cancel proof pending. |
| A17 | Sparse dependency and global remapping unit tests pass; broad mixed fixture matrix pending. |
| A18 | PE2 MDX round-trip unit test passes; complete MDL/MDX fixture and UI save/reopen matrix pending. |
| A19 | Unsupported ingredients explicitly recorded; complete mixed recipes and gallery behavior incomplete. |
| A20 | Actual bulk inventory and coverage metadata produced; extraction failures remain explicit. |
| A21 | Preset disk save and Lab undo preservation pass; restart/copy/stale-thumbnail proof incomplete. |
| A22 | Missing-source/dependency counts exist; actionable UI/build-change matrix incomplete. |
| A23 | Traversal, unsafe keys, typed domains, overflow, depth tests pass; full oversized recipe schema audit pending. |
| A24 | No latency/FPS claim. Measurements not run. |
| A25 | Draft persistence and read-only guard exist; complete keyboard/recovery/read-only exercise pending. |
| A26 | Warcraft in-game testing not run. |
| A27 | Native effect thumbnail gallery and appearance search present; names/categories not reviewed. |
| A28 | Actual local extraction/rescan and bad-asset continuation demonstrated; automated cancellation/restart proof pending. |
| A29 | Exact duplicate mappings and metadata overlays exist; observed-preview name review/rescan override proof pending. |

## Checkpoint 3 — reset continuation, native gestures and clocks

The user reset the allowance and explicitly allocated the remaining 33 percentage points. The account counter read 4% during this checkpoint (rounded, account-wide); approximately 29 points of this continuation remain. The branch remains isolated and the PR remains draft/unmerged.

Implemented and exercised:
- Latched projected spawn axes, native-angle spread guides, direct emitter aim, and Young/Middle/End opacity/color/size transactions. Aim writes the selected emitter rotation, never its parent.
- Representative size proxy stays pinned while playing beyond the sampled particle's lifespan. A stationary pointer does not alter values. One release is one undo and Escape cancels.
- Actual sprite/streak triangle and texture coverage picking, with overlapping owner cycling. Unit coverage tests pass; main-editor double-click acceptance still needs runtime proof.
- Deterministic native CPU replay (the pinned war3-model controller, no replacement particle engine), 10 ms integration grid split at authored local/global events, exact Squirt events, ribbon history and RNG checkpoints, and coalesced authoring replay retaining the last valid GL frame.
- Secondary independent model/FX clocks, visible unlinked indicator, FX pause without queued bursts, and coherent relinking. Preview settings leave the canonical model unchanged.
- Capture readiness now waits for authoring reconstruction. Thumbnail cache version advanced because older captures could precede reconstructed FX.

Verification:
- 78/78 focused + compatibility tests pass: 14 prototype, 8 native simulation, 56 compatibility.
- Native tests prove display-rate independence at identical model/global time (exact particle-state equality on the fixed integration grid), one-millisecond emission windows, repeated global events, frozen model with advancing FX, FX pause/resume, ribbon history restoration and partial-step checkpoint replay.
- Electron actual mouse tests pass: pinned size held for more than 2 s during playback, width, aim, single-stage opacity, one-step undo, cancellation, mode-switch canonical equality, independent clock behavior, relink preservation, and stage width at 1400x920 and 960x720.
- Screenshot review found the initial smoke test raced the Lab discard prompt; it had placed the starter. The test now waits for the prompt and asserts LowFire/LowSmoke source emitter identity before placement. The corrected run displays real orange Flame Strike embers, places that effect, and reports zero JavaScript page errors.
- Vite production build passed and tracked dist rebuilt. Offscreen screenshots are automated evidence, not user visual acceptance.

Still required: global-period endpoint/loop seam tests, bounded preview overload behavior, ribbon controls/sweep path, placement ghost and surface/pivot handling, full Picture tools, personal preset portability/management, complete corpus compatibility/naming review, visible owner-picking runtime tests, MDL/MDX UI save/reopen, recovery/read-only proof, and measured performance. Native ModelSpace and atlas-frame rendering require source-level compatibility review. Warcraft testing remains unverified. The earlier acceptance table is historical checkpoint-2 status; this checkpoint updates only the evidence described above. This is not contract completion.
