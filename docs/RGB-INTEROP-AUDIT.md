# Animated geoset RGB interpretation

Status: candidate; live comparison with Retera/MDLvis is not yet verified.

## Proven mismatch

In Downloads/fsfsfsfsfs.mdx, geoset 18, Walk (333-900), the KGAC key
contains `[1, 1, 0]`. MDLvis displays R=0, G=255, B=255. The previous
MDLxL build displayed R=255, G=255, B=0 at both 333 and 900.

Static GEOA triples are RGB. Animated KGAC triples and their spline tangents
are BGR. Retera's GeosetAnimationChunk.GeosetAnimation(GeosetAnim) explicitly
reverses static colors when exporting its BGR internal representation but
writes animated colors and tangents without that reversal:
https://github.com/Retera/ReterasModelStudio/blob/master/craft3data/src/com/hiveworkshop/wc3/mdx/GeosetAnimationChunk.java

The prior audit initially reversed both static and animated colors. A later
change (36ef722) removed all conversion. The subsequent general color-display
patch again treated static and animated values alike. Finally, e3e1f3c fixed
Unanimated sampling but did not address animated channel interpretation.

The candidate converts only KGAC keys/tangents at the existing symmetric
MDX read/export boundary. The editable model, numeric controls, timeline,
Three viewport and Warcraft preview all use RGB. Static GEOA and retained
static bases remain untouched. No supplied model files were written.

## Verification

- A directly encoded external MDX fixture failed before the correction for
  both display and RGB input. All three interop tests pass after it.
- 67 focused RGB and compatibility tests pass. Build and package pass.
- Both fsfsfsfsfs.mdx and Desktop/lol.mdx now sample geoset 18 as RGB
  `[0, 255, 255]` at Walk frames 333 and 900. No-op saves are byte-exact.
- An alpha-only edit retains color keys, tangents and static-base bytes.
- Entering R=255, G=0, B=100 emits BGR `[100/255, 0, 1]` in KGAC and
  reopens with the entered RGB values.
- The wider animation-tracks suite has two failures also reproduced on the
  existing checkout: negative-frame rejection and disabled-color MDL export.
  The wider keyframe-timeline run stalled and was stopped.
- The packaged candidate is release/rgb-interop/MDLxL-win32-x64/MDLxL.exe.
  It was launched with the comparison file. Windows-control inspection twice
  timed out awaiting app approval; visual parity must not be claimed yet.
