# Citadel Paint working lane

Status: user accepted the overall direction and authorized final cleanup, translations,
English/Russian PDFs, 0.17.0 release, offline upgrade and announcements on 3 October 2026.
Review lane: [PR #73](https://github.com/KlugerA/MDLxL/pull/73).

## Authority and workspace

- Latest cleanup budget: up to 15 additional percentage points, starting at 9 percent
  account usage (ceiling 24). Earlier phase budgets are superseded.
- Hold R starts off-surface strokes without expanding the selected paint region.
  Comma/period rotate stamps. Selection feedback and all Paint languages are included.
- Grabthrough defaults on only in Vertices; Bones keeps its off default.
- Publish through PR #73, verify merged online main, then publish 0.17.0 and replace
  the offline install with complete profile/personal-file preservation.
- Existing Mega Garithos Bot workflow announces to #patches. The user authorized a
  separate Russian announcement/PDF to Discord channel 1550117364107051058 in server
  1550108401235796118. Browser/desktop control currently fails during kernel startup;
  do not claim that channel post was sent without evidence.
- No model switching, agents or automatic continuation. Open the updated program as
  the last operational action. Preserve existing tester windows and source fixtures.
- Worktree: C:/Users/PC/.codex/worktrees/citadel-native-paint/MDLxL.
  Branch: codex/citadel-native-paint. Base main 1273cf3 includes 0.16.1.
  Primary checkout on codex/model-tabs is untouched. Untracked Textures are personal.

## Current implementation

[DESIGN.md](DESIGN.md) documents the workflow. Paint/Stamp/Erase are the main
modes, with Blend and Pick as brush options. Selection works in any tool;
Shift adds and Ctrl subtracts across parts. Stamps commit on release and can be
repeated. Palette ramps, five brushes, tiny-brush crosshairs, image ghosts,
view-only shading/outlines/Colorfy, direct borrow buttons, wheel zoom/pan,
copy/mirror/paste, protected pixels and in-place selected-face UV edits are in.
Green key labels and a dismissible guide support learning the shortcuts.

Global mesh shortcuts no longer intercept Paint's copy/paste. Blend strength
caps an entire stroke instead of accumulating to full strength. Real Colorfy
pixels and selection are checked, not just its toggle state. Camera roundoff no
longer discards projection caches between stamps. The first uncached stamp is
still noticeably slower; retain that limit in any performance claim.

## Verification and next boundary

[VERIFICATION.md](VERIFICATION.md) records 217 focused Paint/compatibility/localization
checks, 72 particle tests, Electron workflows, build and package checks. Both supplied
MDX800 models keep their original file hashes and exported rig/animation data.
The editable study is `out/citadel-audit/demo-1790979188839/Gold-footman-study.mdlxlpaint`.

Current main is integrated; the regenerated bundle passed the Paint interaction
and save/reopen flows, six emitter tests and 24 NormalsXL tests. The feature branch and
existing PR are the review handoff. Hotfix 809e427 from the user's linked
"Fix library loading failure" chat is integrated in the portable Particle Library
runtime, including activeParticleSample and dependency-free scanner packaging.
Verify the actual PR merge state and main containment before reporting release completion.
Open the latest installed program last.

Prioritize further work from the user's actual test: first-use projection delay,
any confusing selection/UV behavior, and a representative finished reskin. Avoid
returning to automatic global UV repacking or adding another Autoaim control.
