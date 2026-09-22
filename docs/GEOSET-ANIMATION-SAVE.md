# Geoset animation save fix

The editor treated equivalent disabled colors as different authored values.
Visibility editing created `Color: null`; MDX necessarily stored three white
floats. MDL omitted disabled white colors and reloaded `Color: null`. Strict
comparison rejected both transitions. Missing optional GeosetAnim records were
not corrupt, and the supplied model was not repaired or optimized.

## Policy and patch boundary

`src/geoset-animation-defaults.js` documents the actual schema: `Flags & 2`
enables tint, `Color` is a static `Float32Array(3)` or an animated
`{ LineType, GlobalSeqId, Keys }`, and `_MdxDefaults.Color` retains an animated
MDX property's static RGB base. Only absent/null/neutral-white Color is equivalent
when **both** records have disabled tint and neither has a color track.

Animation controls, timeline creation, inspector creation and the existing
explicit repair command use the same neutral visibility-record constructor.
Opening a file creates no additional records. Records are found by GeosetId.
The inspector's explicit tint toggle preserves other flag bits and materializes
neutral white when enabling a formerly absent color. Inline scalar alpha remains
a number, including zero.

`src/editor-document.js` exports a detached color view and retains verification.
MDX writes neutral floats without setting the color bit; MDL omits disabled
neutral color. The existing enabled-white MDL compatibility writer remains in
use. Dormant nonwhite colors and disabled color tracks survive MDX, but produce
an explicit unsupported-loss report for MDL. Malformed active colors are rejected.
The animated BGR/static RGB conversion boundary is unchanged.

`src/save-equivalence.js` applies the narrow paired-record rule, still checks
flags, active colors, animation values/keys/interpolation/tangents/globals and
references, and counts all differences while retaining at most 12 detail paths.
No model values are included in error dumps.

`app/model-save.js`, `app/model-save.worker.js`, and `app/App.jsx` run serialization,
reparsing and verification in a module worker using the existing document and
save entry point. Concurrent attempts share one pending job. Save controls are
restored in the existing `finally` path. A failed job never reaches disk save.
Snapshots associate successful bytes with their model revision; later edits stay
dirty. UV-preview save no longer performs a second full serialization after disk
write. Generated `dist` assets are included because Electron loads that bundle.

## Validation actually performed

- 108/108 focused tests: `tests/*.test.js`, `test/geoset-animation-save.test.js`,
  `test/geoset-color*.test.js`, `test/save-target.test.js`,
  `test/animation-batch.test.js`, `test/history-store.test.js`,
  `test/geoset-animation-repair.test.js`.
- The 13 new regression tests use the unchanged real fixture through
  `EditorDocument.apply`, animation-control functions, `prepareModelSave`, and
  real worker execution. They cover untouched MDX/MDL attempts, all-geoset
  visibility, either missing ID, existing/reordered records, null/absent/white
  defaults, enabled white/black/asymmetric colors, alpha zero, animated alpha/RGB
  with globals and cubic tangents, undo/redo, repeated saves, unsupported dormant
  data, malformed data and deliberate preservation failures.
- The production Vite build passed. `node scripts/package.mjs --check` passed.
- `test/geoset-save.electron.cjs` launched the actual rebuilt Electron app with
  an isolated profile and fixture copy, selected Decay Bone and All, created
  visibility and set alpha zero. MDL failure showed one bounded report, kept
  Modified status and usable controls, and never opened the disk save dialog.
  Subsequent MDX Save As and reopen retained alpha zero with all 48 geosets
  selected. The original copy and supplied originals stayed unchanged.
- Retera's installed `craft3data-0.4.5.jar` independently read the saved MDX:
  48 geosets, 48 GeosetAnim records, all 48 Alpha tracks contain zero at 176667.
  Direct binary tests also establish channel order and byte-exact preservation
  of all original chunks except GEOA and MODL.

The Electron test can be run with `node test/geoset-save.electron.cjs` after the
build. It requires Playwright; set `MDLXL_PLAYWRIGHT_MODULE` to an available
Playwright module directory when it is not installed locally. Outputs, screenshots
and the isolated profiles are written under `out/geoset-save`.
After that run, the independent check uses the installed RMS runtime:
`java -Djava.awt.headless=true -cp "<RMS>/lib/*" org.openjdk.nashorn.tools.Shell test/geoset-save.retera.js`.

### Measured save stages

One final Electron run, milliseconds; timings are instrumentation, not thresholds:

| Attempt | Serialization/preservation | Reparse | Verification | Error formatting |
| --- | ---: | ---: | ---: | ---: |
| Edited fixture MDX | 30.7 | 14.7 | 19.1 | 0.0 |
| Edited fixture MDL (Helper flag rejection) | 301.9 | 960.6 | 8.2 | 0.3 |

The main renderer's 10 ms timer advanced 15 times during the MDX worker job and
134 during the MDL job. Worker setup/snapshot transfer is additional to the
stages above. The original synchronous entry point reproduced ~87 ms MDX and
~557–594 ms MDL pauses in a Node baseline; these are different runtime contexts,
not a same-runtime speedup claim. Worker tests prove repeated attempts are
coalesced and the failed job can be followed by a successful save.

## Remaining limits

**The supplied fixture still cannot be exported losslessly to MDL.** Once the
24 harmless Color differences are removed, comparison reveals 26 Helper Flags
differences (0x100 disappears). No Helper flags are ignored or changed in this
patch. A standard MDL Helper has no raw numeric flag field in the independent
[mdx-m3-viewer reader](https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/parsers/mdlx/genericobject.ts).
The fixture regression asserts the bounded flag-loss rejection. Synthetic models
without this unrelated ambiguity successfully round-trip the specified color
and alpha cases through **both** formats. This is not full MDL acceptance of the
supplied fixture, and no repaired fixture is substituted for that test.

The broader `test/animation-tracks.test.js` has one existing failure: it expects
a negative keyframe to be rejected, while the signed-frame parser accepts it.
That failure also occurs on unchanged `origin/main`. The prior dormant-nonwhite
test also failed on main; it now asserts explicit loss rejection as required.
`test/keyframe-timeline.test.js` timed out without producing test results in a
20-second isolated run on both this branch and unchanged main; it is not counted
as passing. Warcraft playback and a full Retera GUI/render comparison were not
performed. The independent Retera check was parser-level.
