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

## Git workflow

- Do not treat a local-only commit or merge as a completed handoff.
- Make code changes on a `codex/` feature branch and push that branch to `origin`.
- When the user asks to commit, merge, or finish work, push the resulting branch and requested merge to GitHub.
- Report explicitly whether the online `main` branch contains the change.
