# Citadel Paint working lane

Status: feedback-driven redesign is verified and ready for user testing.
User acceptance remains pending. Review lane: [PR #73](https://github.com/KlugerA/MDLxL/pull/73).
No merge or release is authorized.

## Authority and workspace

- Build an approachable WC3 SD model painter around brushwork, colors, exact
  cutouts, game/image sources, five starters, a personal library and in-editor
  part selection/UV adjustment. Follow the user's latest workflow feedback;
  held-stamp confirmations and the earlier Autoaim design are superseded.
- The user explicitly resumed with “Go ahead” after the reset. This phase began
  at 0 percent used; the latest observed shared meter is 8 percent used on
  3 October 2026. Another 50 percentage points were authorized, not a requirement
  to waste the entire allowance. The earlier 19:00 boundary/reset wait belonged
  to the exhausted phase and was superseded by this direct later resume.
- Do not switch models, spawn agents, or schedule automatic continuation.
- Open the latest built program visibly as the **last operational action** before
  yielding for testing. Finish checks, docs, push, PR and quota work first. Use a
  fresh profile and the saved Footman study. Preserve prior tester windows,
  original models, personal library files and the untracked Textures folder.
- Worktree: `C:/Users/PC/.codex/worktrees/citadel-native-paint/MDLxL`.
  Branch: `codex/citadel-native-paint`. Original base: 9e9a41c, v0.16.0.
- Main advanced to 386453a (EMTR ribbon attachment fix) during this phase.
  Its fix is integrated into this feature branch with regenerated hashed dist.
  The main checkout remains on codex/model-tabs at 85b7cec, untouched.
- No merge of the Paint PR, release, version bump, offline install replacement,
  deletion of personal files, or announcement is authorized.

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

[VERIFICATION.md](VERIFICATION.md) records 141 Paint tests, 62 compatibility/
WarmKeys checks, seven Electron workflows, build and package checks. Both supplied
MDX800 models keep their original file hashes and exported rig/animation data.
The editable study is `out/citadel-audit/demo-1790979188839/Gold-footman-study.mdlxlpaint`.

Current main is integrated; the regenerated bundle passed the Paint interaction
and save/reopen flows and six emitter regression tests. The feature branch and
existing PR are the review handoff.
Verify its actual merge state and main containment; do not call this merged or
user-accepted while the PR is open. Open the latest tester last.

Prioritize further work from the user's actual test: first-use projection delay,
any confusing selection/UV behavior, and a representative finished reskin. Avoid
returning to automatic global UV repacking or adding another Autoaim control.
