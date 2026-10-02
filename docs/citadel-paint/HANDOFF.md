# Citadel Paint working lane

Status: the **new Paint editor** is implemented and undergoing AFK verification.
The previous Autoaim iteration is superseded. User acceptance remains pending.
[PR #73](https://github.com/KlugerA/MDLxL/pull/73) is the attached review lane.

## Authority and workspace

- User authorizes a remake: a powerful, approachable toy-like model painter for
  WC3 SD, with five starter textures, a personal library, native/file images,
  cutting/stamping, color painting/blending, and selection within Paint.
- Use the remaining current allowance while the user is AFK. Latest request:
  finish the remaining 10%, then await their reset in about four hours. After
  direct reset/resume, another **50 percentage points** are authorized. The old
  40-point/reserve split is superseded. Do not switch models or spawn agents.
- Initial lane baseline was 69% used; remake began around 86%. Latest observed
  shared meter is **92% used / 8% remaining**, 2 October 2026. This rounded
  account-wide meter is not precise per-chat attribution. Recheck before stop.
- Earlier 19:00 Amsterdam boundary remains unless the user changes it.
- No scheduled wake-up or automatic continuation after a reset. Await the
  user's direct reset/resume message. Preserve progress before exhaustion.
- **Opening the latest built program for the user is the last operational
  action before waiting.** Complete checks, documents, push, PR and quota work
  first. Use a fresh profile and unchanged original Footman. Do not close prior
  user tester windows or overwrite their files.
- Managed worktree: `C:\Users\PC\.codex\worktrees\citadel-native-paint\MDLxL`.
  Branch: `codex/citadel-native-paint`; base main `9e9a41c` (v0.16.0).
- Primary checkout remains on unrelated `codex/model-tabs` at `85b7cec`.
  Preserve its state and this worktree's user-owned untracked `Textures/`.
- No merge, release, version bump, offline installation change or announcement
  is authorized. Push this feature branch and attach the PR; do not merge.

## Current implementation

See [DESIGN.md](DESIGN.md) for the accepted direction, current mechanics and
honest limits. The new layout is `app/PaintStudioLayout.jsx`; the existing
workspace owns paint state, projection and persistence. The old Autoaim UI and
helper are removed. Its obsolete Electron harness and the superseded native
workflow harness are replaced by studio, library, brushes and surface coverage.

Current features: simultaneous model/texture views; paint, held adjustable
stamps, blending and erasing; full-image/texture/highlight borrowing; native
starters and a user library; enlarged cutouts; exact PNG reuse; whole-geoset,
connected-piece, face and texture selection; view isolation; explicit
independent selection pixels without splitting geosets; undo, portable project,
Warcraft archive and ordinary MDX save/reopen.

Meaningful corrections found during actual UI checks include source coordinates
being displaced by filter footprints, transparent PNG rounding, and selected
base-coat colors receiving incorrect alpha. All have targeted verification.

## Evidence and next work

[VERIFICATION.md](VERIFICATION.md) lists the latest runs. Original Footman
SHA-256 remains `7ee255776a6e757bd89766354df763201cd0519c488585b7c30151d5e313fc13`.
Native installed Footman/Grunt/Blacksmith model files are MDX1800 and were not
converted to manufacture compatibility evidence. Use actual MDX800 fixtures.

Before handoff: repeat affected UI flows after any final edits, rebuild tracked
dist, retain only intended source/dist changes, push the review branch, refresh
PR title/body around the remake, inspect its open/unmerged state and main,
record the final quota reading, then launch the latest editor visibly LAST.
Do not call this user-accepted or complete integration while the PR is open.

Prioritize remaining work from actual visual results: compressed/shared mapping
behavior, a representative finished reskin, and cold-gesture responsiveness.
Do not spend the remaining allowance only repeating already-passing tests.
