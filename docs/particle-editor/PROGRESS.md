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
