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

## Checkpoint 4 — ribbon sweeps, placement and pictures

Account counter: 9% after reset, approximately 24 of the continuation's 33 percentage points remain. This remains an isolated prototype on codex/particle-editor-prototype, draft PR 60; no merge, release or version bump.

Implemented and exercised:
- Native ribbon controls and direct edge gestures, source-pose sweep paths, ambiguous-crossing time choices, focused looping and explicit emission windows. Demonstration motion exists only in preview clones.
- A live placement ghost with attachment selection, draggable anchor, pivot and surface placement mechanisms, source/target motion choice and explicit confirmation. Cancel leaves target and history unchanged; confirm is one insertion; undo/redo reproduce exact canonical target states.
- Actual Picture atlas with separate four native frame ranges/repeats, explicit correction before shrinking an incompatible grid, and ten sequential native blend comparisons across light/dark surfaces.
- Portable custom picture bytes, bounded generated asset paths, preset duplicate/export/import/tag APIs and UI, draft embedding, cached page thumbnails, stale-thumbnail invalidation and visible thumbnail failures.
- The private pinned-renderer adapter now carries ModelSpace particles through the emitter matrix and respects atlas repeats and rectangular atlas indexing. No imported library was edited. Compatibility reference: https://raw.githubusercontent.com/flowtsohg/mdx-m3-viewer/master/src/viewer/handlers/mdx/particle2.ts and https://raw.githubusercontent.com/flowtsohg/mdx-m3-viewer/master/src/viewer/handlers/mdx/shaders/particles.vert.ts . These are renderer references, not Warcraft acceptance.
- A visible preview budget stops excessive reconstruction without rewriting authored values. Native global endpoint events and focused-loop reconstruction are tested.
- Recipe documents open from a complete native MDX boundary so surgical MDL saving retains their dependency tables; ribbon MDL and MDX round trips now pass.

Verification:
- 93/93 targeted and compatibility tests pass (14 recipe/binding, 11 native preview, 7 sweep, 5 library, 56 compatibility).
- Rebuilt dist and offscreen Electron test passed: all checkpoint-3 gestures/clocks; actual atlas cell edits; explicit grid correction; ten blend captures; importing and saving embedded custom bytes; real CASC Flame Strike source identity; ghost drag/cancel/confirm/undo/redo; ribbon edge gesture, demonstration isolation and emission window. Zero JavaScript page errors.
- Screenshots inspected: real CASC placement ghost, blue ribbon sweep and Picture workspace. Ribbon demonstration framing clips part of the path and needs refinement. Offscreen automation is not user acceptance.

Remaining work includes direct life changeover marker and burst timing, complete teaching examples, preset import/export and restart UI proof, recovery/read-only/no-model checks, source-group extraction and unsupported gallery identities, stock naming review, parent/replaceable/renderer coverage, main-editor picking runtime proof, UI MDL/MDX saving/reopening, performance measurements and per-gate final evidence. Warcraft validation remains unrun. The library is a labeled subset, not complete classic coverage. This checkpoint does not satisfy the entire contract.

## Checkpoint 5 — timing, recovery, source identity and measurements

Account counter read 11% after reset; approximately 22 of the 33 continuation points remain. No merge or release is authorized.

Implemented/tested: direct Middle life marker with safe 0/1 display; native Continuous/Burst choice retaining the emission representation; explicit one-burst command and one-undo movable impact time; burst amount edits retain zero boundary events. Global-track gestures now latch the independently displayed global phase. The prototype also includes six labeled original starters (sparks, smoke, layered glow, impact, streak, ribbon), all saving to both native formats in tests.

Stock indexing now records source-model particle groups separately from single emitters, follows external model dependencies, keeps physical namespace/content hashes, and shows extraction failures as unavailable catalogue entries. Actual schema-3 scan: 3,486 candidates, 3,485 parsed, 4,581 valid recipes, 437 unavailable identities (5,018 total cards). See coverage-summary.json for group/dependency/duplicate counts. A separate real-source cache demonstrated cancellation after 25 assets and resumption to 50 without reprocessing the first batch. Source resolution rejects missing installations, changed builds and mismatching dependency bytes. Invalid globals, bind-pose graphs, PE1 simulation and Popcorn remain explicit limitations.

Preset UI checks passed: tags, independent duplicate, export, import, custom-picture bytes, actual native close before the autosave debounce, restart without a model argument, and exact recovered Lab model plus undo depth. Zero JS errors. Close uses the existing pending-work flush and scan shutdown awaits its checkpoint. Source recipe metadata is retained when editing copies, and no preset/target changes happen during browsing.

Performance: retrospective archived-base comparison on recorded Ryzen 5700X / RTX 5060 Ti hardware. Both baseline and current paths measured approximately 50 FPS with about 800 particles. Size p95 input-to-draw 15.7 ms; Speed p95 57.5 ms. Heavy fixture stopped with the visible 12,000-particle budget and retained authored values. See PERFORMANCE.md for fixture, methods and limits; the requested pre-implementation measurement was not performed, 60 FPS was not reached, and these are draw-submission measurements rather than OS scanout.

The measurement exposed and fixed cross-slider focus/blur transaction ordering. Native ReplaceableId handling, ribbon coverage picking, perspective-correct sprite UV picking and opaque-surface occlusion were added to the private compatibility/picking adapter. Unit proof exists; full main-editor picking and broad renderer/game acceptance remain pending. Preview clipping, unusual blend/replaceable combinations, complete source-name review, source-context viewing, full UI MDL/MDX save/reopen and per-gate final evidence still need work.

Verification: 99/99 focused plus current compatibility tests pass. Vite production build and the expanded Electron workflow passed; tracked dist rebuilt. No Warcraft in-game testing, desktop package or install has been performed. The catalogue is still a partially reviewed subset, not complete classic effect support.

## Checkpoint 6 — native output, source context, appearance review and examples

Account counter: 16% after reset, approximately 17 of the continuation's 33 points remain. The prototype remains on its isolated branch and draft PR 60. No merge, release or version bump.

Implemented and exercised:
- Reviewed 32 actual native CASC captures. Added 31 appearance names/categories/tags bound to exact source content hashes; the blank/ambiguous ribbon remains unreviewed. Reviewed effects lead the default gallery. User overrides survive rescans without rewriting recipes; manifest and catalogue report reviewed counts separately. The rest of the 5,018-card catalogue still needs appearance review.
- Activity sampling now waits for continuous emitters to accumulate particles and selects the matching active animation when opening Lab. Fit uses live geometry and includes authoring guides; it does not repeatedly move the camera during slider edits.
- Full source-model context is available only from effect Details. It verifies the indexed model hash/build/namespace, resolves source pictures within that namespace, and uses the shared renderer. Desktop checks confirm it leaves both Lab and the target unchanged. Missing/unsupported context ingredients remain explicit.
- Five original paired examples: smoke expansion/fade, spark density/lifetime, layered glow, movable native impact time, and PE2 streak versus ribbon with the same demonstration motion. Both sides share seed, camera, animation time and global phase. Demonstration motion stays out of the recipe. Native saving and actual comparison captures pass.
- Team-color/glow pictures now appear in atlas and life samples using the preview team color; selecting them remains one undoable native edit.
- Natural full-clip loops carry surviving particles and ribbons through wraps. Local boundary bursts fire once per cycle; focused subrange looping still reconstructs. A paused explicit seek to the clip end inspects that endpoint before resume wraps. Fixed-grid partition equality and endpoint tests pass.
- Main viewport double-click opens an existing owner; repeated overlapping picks cycle owners. The invisible-effect list remains editable. Hidden model geometry no longer blocks particle hits. Alpha coverage is unit-tested; alpha-tested mesh occlusion still requires work.
- Particle Lab is now available while the loaded model is read-only. On-model controls and insertion stay disabled, and keyboard undo cannot bypass the guard.

Verification: 113/113 focused, desktop-menu/settings and current compatibility tests pass. Production build passed; tracked dist rebuilt. Expanded offscreen Electron workflow passed with zero JS errors, including comparisons, source context, team pictures, placement and native-close recovery. A separate mixed stock/custom-picture PE2+ribbon fixture passed actual UI MDL and MDX Save As and reopen; exact expected serialized bytes, clean reopened documents, retained picture sidecar bytes, invisible-list editing, main viewport overlap picking and read-only behavior were checked. Original input bytes stayed unchanged.

Performance rerun after full-loop changes: baseline 50.00 FPS, current 50.00 FPS at about 796–800 particles; Size p95 15.8 ms, Speed p95 53.3 ms. Heavy preview retained authored values and stopped at the same explicit 12,000-particle budget. See PERFORMANCE.md for method and limits.

Still open: repeated-instance/game-distance test view, full parent/axis/direct-gesture matrix and surface/pivot UI proof, source lifecycle/weapon coverage, PE1 simulation, remaining source exceptions, broad appearance review, native draw ordering/ribbon gravity compatibility, and Warcraft game acceptance. Captures are offscreen automated evidence, not user visual acceptance. This is a working prototype checkpoint, not complete contract fulfillment.

## Checkpoint 7 — repeated-instance inspection and ribbon history

Account counter: 18% after reset; approximately 15 of the allocated 33 points remain. Branch and draft PR remain isolated, with no merge or release.

A temporary Test view now renders 1, 4 or 9 copies of the current effect through the shared native preview. It provides close/game-like/far viewing distances, two team colors, light/dark backgrounds and optional live-count/cost details. Inspection copies and their anchor offsets never enter either document. The Picture orientation details now expose Carry particles / Leave behind and a preview-only motion demonstration. Authoring controls are disabled while snapshot inspection views are open.

The pinned renderer's ribbon buffer allocation stopped growing at its initial capacity. The adapter now expands runtime capacity before the native allocator and samples animated ribbon Color for drawing while retaining the original track. Targeted tests cover more than 256 history segments and RGB reaching the native draw call. Ribbon gravity and advanced draw ordering remain explicitly unverified/unsupported in preview; their authored values are preserved.

Verification: 115/115 focused, desktop-settings and compatibility tests pass. Production build and expanded Electron workflow pass with zero JS errors. Actual four-instance rendering, distance/team/background changes, optional cost details and unchanged Lab/target documents were exercised. Placement tests now also snap the ghost to a parent pivot and a posed surface, then confirm once, undo exactly and redo. Earlier MDL/MDX Save As/reopen evidence remains in checkpoint 6. These automated windows are offscreen; user visual acceptance and Warcraft execution remain outstanding.

See ACCEPTANCE.md for the current per-gate evidence and remaining limits, replacing the historical checkpoint-2 table as the current status.

## Checkpoint 8 — visible tester, transformed parents and mesh-aware picking

Account counter: 21% since reset, approximately 12 points of the continuation allocation remain. The user requested a visible tester; the isolated production build was opened in a separate profile, the effect gallery and live edits were demonstrated, and control was handed to the user. The user then said it was okay and asked to close and continue. The native close saved the test Lab draft. This is a visible prototype interaction, not acceptance of every contract gate or game fidelity.

A new animated, rotating, nonuniformly scaled parent fixture exposed a real Lab-to-model context-switch crash: the early live-update effect could apply new parent references to the old renderer before structural replacement. Live scalar updates now verify the current renderer owns the current model. The existing context remains stable during ordinary drags. Fit view also cancels an active gesture explicitly.

Actual pointer tests now prove stationary input creates no edits while the parent keeps moving, a held drag creates no further changes, the original key stays latched, a completed drag creates one undo step, parent/geometry remain unchanged, broad spread stays finite, aim edits only the emitter and a zero-length handle is keyboard-editable. The production build and existing full editor and separate save/reopen desktop workflows pass afterward, with zero JS errors. The held-particle-death test now waits for observed simulation time rather than assuming 2.2 seconds of wall time always includes two seconds of playback. Focused suite: 116/116.

Particle selection now respects native posed, front-facing, depth-writing model surfaces, alpha-tested picture holes and animated UVs. Hidden faces, fractional-alpha layers and NoDepthTest/NoDepthSet do not block effect hits. A targeted fixture covers these cases without mutating its model. Base-level bilinear alpha is used; distant mip edges and multisample coverage remain approximate, and HD material details are outside this proof.

Corrected a manifest naming-count edge case: an unreadable asset with no source hash was accidentally counted as reviewed by comparing two undefined values. The actual incremental CASC rescan now reports 31 reviewed and 4,987 review-needed entries consistently.

## Checkpoint 9 — lifecycle evidence, timing preservation and ingredient inspection

Account counter: 25% since reset, approximately eight of the continuation's 33 allocated percentage points remain (rounded, account-wide). This working prototype is ready for further 5.6 refinement, with the outstanding contract gaps recorded in HANDOFF.md and ACCEPTANCE.md. No merge, release, version bump or desktop install was performed.

Implemented and exercised:
- Clip fitting now retains authored Hermite/Bezier keys and tangents without synthesizing boundary keys. Native endpoint holds and empty-clip defaults remain intact; the old boundary insertion could distort a cubic curve or pull a value from another clip. Source immutability, sampled equivalence and MDL/MDX reopening pass.
- Picture details expose separate Face camera / Flat choices. Changes to unsimulated lighting/fog flags produce a specific notice. Actionable save/limitation messages take precedence over the demonstration-motion hint; stale readiness errors from a disposed preview cannot replace the current status.
- Thumbnail writes carry a recipe revision including renderer version, source build, file revision and reviewed sample. Preset changes and game-build changes reject late old captures. Gallery loading requests are serialized, and review captures use the same hash-bound sample choices as the library.
- The on-demand Ingredients view renders compact stills sequentially. Each ingredient can be selected and muted for preview; the default stage retains only the small entry button. Whole-group saving explicitly identifies its ingredient count. Tests prove native visibility, all ingredients, Lab/model contents and undo histories survive mute, selection, inspection keyboard input and saving. A discovered Lab-selection callback leak into the main model selection history was corrected at its owner.
- Ingredient thumbnail framing excludes editing guides. Both original glow layers have observable image coverage and were visually inspected after the correction.
- Ninety-nine real source lifecycle/weapon samples from Golem, Direwolf and Blademaster recipes completed with finite native state, unchanged sources and no JS errors. Thirteen contained active geometry; authored inactive phases were retained. See LIFECYCLE.md. Three additional source-bound appearance names bring the reviewed total to 34, with 4,984 still needing review.

Final checkpoint verification: 118/118 focused, desktop-settings and compatibility tests; production Vite build with tracked dist rebuilt; full actual Electron gesture/clock/Picture/placement/ingredient/preset/close-recovery workflow; 34 reviewed stock captures; mixed stock/custom-picture PE2+ribbon UI MDL and MDX Save As/reopen; invisible-list and main-view overlap selection; read-only behavior; and the animated nonuniform-parent pointer/keyboard regression. All passed. Automated windows remain offscreen; the earlier user-driven tester was closed with its draft saved. No Warcraft runtime testing was performed.

The catalogue and renderer remain incomplete for all-classic acceptance: PE1, explicit source exceptions, some native fidelity, no-animation-target placement, broad naming review and the remaining accessibility/source matrix need follow-up. The prototype must remain on its isolated branch and draft PR. This checkpoint does not claim complete contract acceptance or a green historical whole-source suite.
