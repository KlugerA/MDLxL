# MDLxL Project Instructions

## UI: the spirit of VIS

- Keep MDLxL simple and compact, in the spirit of MDLVis and the VIS button.
- Implement the literal request in the existing workflow. Do not expand it into
  an unsolicited panel, dashboard, toolbar, menu redesign, or extra application.
- Preserve existing sidebars, their widths, and their controls unless the user
  explicitly asks to change them. New functionality does not imply permission
  to occupy more permanent screen space.
- Show only the smallest relevant indicator by default. Reveal explanations and
  editing controls only after the user deliberately clicks that indicator;
  keep them dismissible and out of the normal layout.
- Motion irregularities belong beneath the existing timeline keyframe diamonds.
  Before a warning is clicked, show no Motion Inspector panel, results list,
  numerical inspector, scan controls, or other permanent diagnostic UI.
- Verify the uncluttered default view as well as the explicitly opened details.
- Motion warnings must target severe jumps or strongly evidenced stray/holding
  keys. Ordinary speed changes, slight deviations, and intentional attack or
  walking motion are not warnings by themselves. Check false positives against
  the user's known-good animations; do not hard-code animation names.
- Distinguish the observed jump from the keys constraining an intended pose.
  Hand selection to the existing bone/channel/keyframe tools. Preserve the
  user's intended pose, and select exact holding keys without including that
  pose in a continuous deletion range. Removing the intended movement merely
  to make a warning disappear is not a successful repair.

## Versioning

- Advance the project version for every patch release; do not reuse a version
  name for later patches. Use semantic versioning: patch for fixes and small
  maintenance changes, minor for backward-compatible features, and major for
  incompatible changes.
- Keep the version in `package.json`, the README title, and the current-version
  summary in the README in sync. Update these together when preparing a release.
- Do not change the version for unshipped local edits alone. Before publishing,
  choose the next version from the latest released version and include all
  changes intended for that release.

## Git workflow

- Do not treat a local-only commit or merge as a completed handoff.
- Make code changes on a `codex/` feature branch and push that branch to `origin`.
- Open a GitHub pull request from the feature branch into `main` and attach its
  URL to the Codex chat before merging. A direct merge or push to `main` is not
  an accepted way to finish project work.
- Merge through the pull request only after the user authorizes merging.
- Before reporting completion, verify that the attached pull request is merged
  and that the online `main` branch contains its change. Report both results.
