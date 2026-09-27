# Startup performance, 2026-09-27

This lane removes unnecessary work from launch without changing model data,
rendering settings, the editor layout, or the crash-recovery prompt:

- Use the bundled pressed-keys icon. The previous mount effect started Warcraft
  discovery (up to 700 directories) and native archive access for that icon.
- List historical recovery drafts at startup only when a crashed dirty session
  needs a prompt. File / Recovery still lists drafts on demand.
- Load Settings, the UV workspace, and Forge/part commit dependencies on demand.
  Keep UV CSS available before the detached window copies the styles.

The initial JavaScript bundle decreased from 2,471,693 to 2,260,427 bytes
(211,266 bytes / 8.55%). Both sizes are rebuilt from source using the same tools.

## Measurements and limits

Windows, Electron 40.8.0, NVIDIA RTX 5060 Ti / D3D11. Each source-build series
contains five hidden launches: one fresh or copied profile, then four launches
reusing that profile. The copied profile includes settings, browser local
storage, discovery cache, and 87 recovery files; the installed profile was not
modified. The baseline is source commit `55e959f` rebuilt separately.

Time is from process launch until a viewport canvas exists and the Grid control
responds to a DOM click through React. This does not measure visible first paint;
hidden windows do not supply normal compositor frames. OS caches were not
flushed, and neither MDLVis nor Retera was launched for a comparison.

| Profile | Baseline median (range) | Revised median (range) |
| --- | --- | --- |
| Fresh, then reused | 1,038 ms (1,003-1,113) | 972 ms (963-995) |
| Copied installed profile | 974 ms (935-1,045) | 981 ms (976-1,029) |

The normal-launch improvement is modest; the copied-profile change is within
run-to-run variation. The portable test build measured 954 ms median over three
launches (954-1,031 ms). These results do not establish parity with other editors
or reproduce the reported long intermittent stall. A separate CPU trace found
roughly 0.5 seconds blocked in initial WebGL context creation. A GPU-information
warm-up experiment did not improve this and was not included.

## Validation

- `node test/startup.electron.cjs`: passes with recovery enumeration deliberately
  held indefinitely during a normal launch. No game-data discovery occurs.
  Manual recovery and the crash prompt restore geometry and undo history;
  first-use Settings, Forge, and detached UV loading/styles pass.
- `node test/startup-benchmark.electron.cjs [app directory or exe] [runs=5] [profile to copy]`:
  writes per-launch timings to a fresh directory under `out/startup`. It always
  uses an isolated profile. Set `MDLXL_PLAYWRIGHT_MODULE` if Playwright is external.
- 56 compatibility tests and 39 focused storage/session/Forge/parts/preferences
  tests passed. Additional desktop-settings, Forge, and UV checks passed 22/23.
  The remaining `forge-hd.test.js:58` assertion expects `/0 to 255/`, while the
  existing error says `DummyBone object ID exceeds this weighted skin format.`
  The same failure was reproduced on the untouched baseline and left unchanged.
- Production build and portable packaging passed; 549 runtime/asset files and
  all 55 Electron locales verified. No supplied models or installed files changed.
