# Resource managers

The original geoset grids and Vertices, Bones and Movement controls are retained.
Animations adds a compact Nodes selection below Geosets, using the existing
Visibility On/Alpha controls and bottom timeline. New visibility tracks use held
keys. Selecting a geoset returns the controls to their existing geoset scope.
Material-layer and attachment Visibility links select their exact native track
in Animations. Global tracks select their clock; mismatched-clock edits are
rejected without changing the track. Existing interpolation is retained.

The managers have no duplicate visibility timelines, range panels, filler prose
or Clueless/Classic selector. Node Manager has a wider, wrapped, color-coded tree
and native hierarchy, parent, pivot, flags and event controls. EMTR owns emitter
visual properties. All four managers use the same transparent backdrop and live
viewport behavior. Windows remain draggable; material/geoset previews isolate
and frame one geoset, including shared-material cases.

## Event objects

Sound, Blood Splat, Footprint, Uber Splat and Spawn Object choices load from the
configured game files. Native IDs and names are used; no game assets are bundled.
Event times can be added at the current frame or removed. Existing parent, pivot
and event times are preserved when choosing event data.

Classic sound IDs join AnimLookups to AnimSounds. Reforged AnimationEventCode and
dialogue-file tables map sound labels to real files. The selected sound preloads
into an audio player. Missing definitions/files are reported, never substituted.
The existing MPQ reader cannot decode some compressed WAV sectors; playback from
the installed CASC sound files was verified.

Sounds are grouped in collapsible, color-coded folders from their game paths.
Search includes names, event IDs and categories. Opening or closing folders
preserves the list's scroll position. Sound lookup first tries the authored path, then uses the
installed CASC sound index and content keys for the same logical file in its
installed language/module and actual audio format. It does not guess renamed
files. A new selection clears the preceding audio immediately.

Blood Splat, Footprint and Uber Splat selections have a looping animated preview
with pause and scrubbing. It uses the existing event renderer, native atlas
frames, timing, colors and blending. Its preview clock does not edit the model.
Isolated geoset cameras fit the actual rendered pose at the selected frame.

## Research

Checked 3 October 2026:

- [Hive: Texture changes](https://www.hiveworkshop.com/threads/texture-changes.183769/) - Filter mode, Transparent, Add Alpha and native material terminology.
- [Hive: Event objects](https://www.hiveworkshop.com/threads/adding-event-objects-in-3dsmax-5.7396/) - SND, SPL, FPT, UBR and SPN conventions.
- [Hive: Effects in Magos](https://www.hiveworkshop.com/threads/making-effects-in-magos.35101/) - emission visibility versus particle alpha.
- [XGM: MDL structure](https://xgm.guru/p/wc3/mdl-structure) - native resource records.
- [Upstream viewer](https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/viewer/handlers/mdx/handler.ts) - classic and Reforged sound-table mappings.

## Verification

Appearance presets include their own folder/list background, text, selection,
hover, hierarchy lines, node-type colors and sound-folder category colors.
Settings > Appearance exposes these colors and the list font size (10–20 px).
All fourteen Appearance categories start expanded and can be collapsed.
Custom presets and configuration exports retain the tree palette, font size,
application theme and accent. Older profiles acquire a palette from their
existing theme. These settings apply to manager lists; editor sidebars keep
their existing controls and sizes.

The appearance checks pass all 26 source tests. A rebuilt Electron test checks
all seven palettes, category collapse state, custom colors, 17 px list text,
custom-preset switching and on-disk preference persistence. Screenshots were
inspected. The sound-folder scroll regression still passes.

The latest focused run passed 70 of 72 source/compatibility checks. The two
event-render-model version assertions also fail on the untouched pre-patch HEAD
and are outside these changes. Coverage includes held keys, owner isolation,
event IDs/times, undo, MDL/MDX fixture round trips, sound mapping, installed-locale
and content-key lookup, cache restart, and ordinary preview preservation.

The rebuilt Electron workflow on the supplied graveguard verifies the original
numbered geoset grids in all four editors, existing visibility checkbox, global
clock selection, exact material-layer targeting, actual audio decoding/playback,
event creation, MDX write/reopen, draggable windows, and actual isolated WebGL
mesh draws. Avatar (AHAV), SpiderDeath (DSPD), PeasantDeath (DPES), FootmanDeath
(DFOO), StarfallTarget (AEST), and CentaurDrudgeDeath (DCDD) decoded and played;
these cover both OGG and FLAC. Native blood-splat pixels change during initial
spread and decay. Geoset 14 at frame 6720 is centered on its rendered pose, fits
without clipping and has the correct canvas aspect. Screenshots were inspected;
the original model is byte-identical.

A read-only audit of the installed game resolved the first sound file for 685
of 710 event entries. The other 25 have absent definitions, placeholder names or
stale paths in the game tables. Those remain explicit unavailable resources;
this does not claim all catalog entries are playable or every variant was heard.

The graveguard's MDL conversion already fails verification on ten helper Flags
fields before edits. Edited MDX save/reopen passes, and focused fixtures pass
both formats. Previously reproduced broader Popcorn codec failures and the
signed-time text-parser test expectation remain outside this patch. This does
not claim the full source suite, Warcraft runtime or user acceptance passed.

No release, merge, offline replacement or original-model save is included.
