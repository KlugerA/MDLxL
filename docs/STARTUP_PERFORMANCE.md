# Startup performance, 2026-09-27

This lane removes unnecessary work from launch without changing model data,
rendering settings, the editor layout, or the crash-recovery prompt:

- Use the bundled pressed-keys icon. The previous mount effect started Warcraft
  discovery (up to 700 directories) and native archive access for that icon.
- List historical recovery drafts at startup only when a crashed dirty session
  needs a prompt. File / Recovery still lists drafts on demand.
- Load Settings, the UV workspace, and Forge/part commit dependencies on demand.
  Keep UV CSS available before the detached window copies the styles.

The initial JavaScript bundle decreased from 2,480,853 to 2,269,590 bytes
(211,263 bytes / 8.52%). Both sizes are rebuilt from source using the same tools.

## Measurements and limits

Windows, Electron 40.8.0, NVIDIA RTX 5060 Ti / D3D11. Each source-build series
contains five hidden launches: one fresh or copied profile, then four launches
reusing that profile. The copied profile includes settings, browser local
storage, discovery cache, and 87 recovery files; the installed profile was not
modified. The baseline is source commit `1586a2e` rebuilt separately. The lane
includes the concurrent NormalsXL merge, and the comparison was repeated after
rebuilding the combined source.

Time is from process launch until a viewport canvas exists and the Grid control
responds to a DOM click through React. This does not measure visible first paint;
hidden windows do not supply normal compositor frames. OS caches were not
flushed, and neither MDLVis nor Retera was launched for a comparison.

| Profile | Baseline median (range) | Revised median (range) |
| --- | --- | --- |
| Fresh, then reused | 976 ms (908-1,045) | 972 ms (890-1,012) |
| Copied installed profile | 939 ms (913-1,066) | 989 ms (903-994) |

These normal-launch differences are within run-to-run variation, so a meaningful
overall speedup is not established. The portable test build measured 1,019 ms
median over three launches (966-1,030 ms). These results do not establish parity with other editors
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
- 56 compatibility tests, 19 NormalsXL tests, and 39 focused
  storage/session/Forge/parts/preferences tests passed. Additional
  desktop-settings, Forge, and UV checks passed 22/23.
  The remaining `forge-hd.test.js:58` assertion expects `/0 to 255/`, while the
  existing error says `DummyBone object ID exceeds this weighted skin format.`
  The same failure was reproduced on the untouched baseline and left unchanged.
- Production build and portable packaging passed; 550 runtime/asset files and
  all 55 Electron locales verified. No supplied models or installed files changed.
