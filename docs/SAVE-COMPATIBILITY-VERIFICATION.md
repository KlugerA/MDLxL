# Save compatibility verification — 2026-10-03

The save pipeline now canonicalizes node IDs on an export snapshot and remaps
parents, matrix groups, skin weights, pivots and node bind poses together. Live
IDs, selection references and undo history stay stable. Camera bind poses remain
after the node matrices, including rig creation/deletion. Repeated saves,
asynchronous edits, recovery and undo/redo are covered.

Generated MDL uses the line and indentation layout accepted by Retera's reader.
Node encounter order agrees with exported IDs, including Popcorn before ribbons.
The codec also corrects MDX particle length/width slots and animated light,
ambient-light and ribbon colors/tangents. Zero Popcorn fields survive MDL export.

Two related edit failures found during the audit are repaired: merging native
empty animation bounds no longer overflows, and the initial pending EMTR replay
initializes material texture references before rendering.

## Independent evidence

Retera's installed `craft3data-0.4.5.jar`, Java 17.0.2 and Nashorn loaded the saved
files in headless mode. The checker uses `EditableModel.read`; it does not use
MDLxL's decoder. Expectations describe the live model before saving.

| Corpus | Saved files | Result |
| --- | ---: | --- |
| Original 41-operation audit replay, using its pre-save live snapshots | 81 | All pass |
| Original synthetic Classic 800 / Reforged 1000 fixtures, first save and subsequent edit | 8 | All data checks pass; Popcorn note below |
| Actual offscreen rebuilt Electron UI operations | 16 | All data checks pass; Popcorn note below |
| Unmodified Knight reference input, all 48 geosets edited for Decay Bone visibility | 1 MDX | Pass |

The original audit had 14 MDX files with wrong node references/pivots and 40 MDL
files rejected by Retera. The regression replay restores the original *live*
values, rather than treating a damaged historical file as the expected result.

The checker compares node count, names, parent identities, pivots, node flags,
static emitter/light/attachment properties, event times/global sequences,
animation values/interpolation/tangents, camera data, node/camera bind poses,
matrix bone identities, HD skin identities/weights, HD tangents, geometry,
normals, UV sets, material/texture references, geoset animations, UV animations
and sequence data. These are loader/data checks, not full viewport playback.

UI operations exercised bone/light/event/particle/ribbon additions across
successive MDX and MDL saves, split/merge of Footman, and editing the HD fixture.
Footman's 11 split geosets merged into 5 compatible groups and saved in both
formats. The placed particle reopened in EMTR On model with a rendered Footman
and without the previous texture `Image` error. A final fresh instance saved a
new bone using the exact final tracked bundle. All instances used isolated
profiles and offscreen windows; no physical input automation was used.

The focused source suite passed **175/175** tests, covering serialization,
lossless containers, node/mesh clipboard, history, recovery, rig edits, geosets,
particles, sounds, version conversion and Save As. An additional existing UV
camera source-pattern test fails against unchanged `GamePreview.jsx`; it expects
an older source expression. Its files are unchanged from the base commit. A
separate `clientHeight` error was logged during the longer UI session; save data
checks passed, but this is not a claim of an error-free UI session.

## Format references and corrections

- [Hive MDX specifications](https://www.hiveworkshop.com/threads/mdx-specifications.240487/)
  describe node IDs/parents, pivots, geometry bindings and PRE2's **length before
  width** layout. The thread's December 2017 correction agrees with Retera's
  `ParticleEmitter2Chunk`; the upstream JS codec had the static pair swapped.
- [Hive MDL datablocks](https://www.hiveworkshop.com/threads/mdl-format-datablocks.186060/)
  document the text blocks and matrix references used by the compatibility cases.
- [Retera EditableModel](https://github.com/Retera/ReterasModelStudio/blob/master/craft3data/src/com/hiveworkshop/wc3/mdl/EditableModel.java)
  establishes its type collection order and indexed pivot/bind-pose resolution.
- [Retera AnimFlag](https://github.com/Retera/ReterasModelStudio/blob/master/craft3data/src/com/hiveworkshop/wc3/mdl/AnimFlag.java)
  and the [Hive viewer animation codec](https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/parsers/mdlx/animations.ts)
  retain classic animated color triples in BGR. MDLxL converts these at its MDX
  boundary so its live RGB values and all spline tangents remain consistent.

## Explicit limits

- Retera's [Popcorn reader](https://github.com/Retera/ReterasModelStudio/blob/master/craft3data/src/com/hiveworkshop/wc3/mdl/ParticleEmitterPopcorn.java)
  reverses static MDX color to BGR but keeps MDL color literally. The
  [Hive viewer Popcorn codec](https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/parsers/mdlx/particleemitterpopcorn.ts)
  specifies RGB for both. The checker records that representation difference;
  Popcorn rendering/re-export parity in Retera is **not certified**. MDLxL does
  not invert valid file data merely to mask the external reader inconsistency.
- The original cross-tab case still refuses MDL export because dormant nonwhite
  GEOA colors cannot be represented without enabling tint. Its MDX passes.
  The Knight reference also retains its existing MDL guard against losing 26
  Helper flag values. Neither guard is bypassed or reported as a successful MDL
  conversion.
- No-op saves remain byte-exact. This patch is not an automatic repair of
  pre-existing corrupt files or arbitrary nonstandard source syntax. Untouched
  authored records, unknown data and existing loss-prevention checks remain.
- Native Retera checks cover versions 800 and 1000. Newer-format source tests
  do not establish support in an older external editor. MDLvis model-open and
  render behavior, Warcraft runtime playback, external sound playback and
  external particle asset availability remain unverified.
- This is source/PR validation, not an installed portable upgrade or release.

## Reproduction and local artifacts

Generate the redistributable synthetic corpus:

```text
node test/save-compatibility-fixtures.mjs out/save-compatibility-synthetic
```

Run the independent checker with the installed Retera Java distribution:

```powershell
& "$retera/bin/java.exe" '-Djava.awt.headless=true' -cp "$retera/lib/*" org.openjdk.nashorn.tools.Shell test/save-compatibility.retera.js -- "$PWD/out/save-compatibility-synthetic"
```

The local `out/save-compatibility-fix-2026-10-03/` directory retains model copies,
expected snapshots, per-file results, source/build logs and UI screenshots.
`out/compatibility-audit-2026-10-03/` retains the original audit unchanged.
Game/reference assets are not added to this PR. The synthetic generator and
independent checker are checked in for repeatable verification.
