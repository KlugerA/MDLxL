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

The sound follow-up handles native SLK paths ending in FLAC when the installation
stores the same sound as OGG. It prefers the exact path, uses the loaded format's
MIME type, and leaves custom paths unchanged. SpiderDeath (DSPD), the reported
failure, now decodes and plays in the Electron regression. Splat and geoset
preview follow-ups remain pending; accepted visibility controls are unchanged.

## Research

Checked 3 October 2026:

- [Hive: Texture changes](https://www.hiveworkshop.com/threads/texture-changes.183769/) - Filter mode, Transparent, Add Alpha and native material terminology.
- [Hive: Event objects](https://www.hiveworkshop.com/threads/adding-event-objects-in-3dsmax-5.7396/) - SND, SPL, FPT, UBR and SPN conventions.
- [Hive: Effects in Magos](https://www.hiveworkshop.com/threads/making-effects-in-magos.35101/) - emission visibility versus particle alpha.
- [XGM: MDL structure](https://xgm.guru/p/wc3/mdl-structure) - native resource records.
- [Upstream viewer](https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/viewer/handlers/mdx/handler.ts) - classic and Reforged sound-table mappings.

## Verification

79 focused source/compatibility tests pass: held keys, owner isolation, material
visibility, event IDs/times, undo, MDL/MDX fixture round trips, sound mapping and
ordinary preview preservation.

The rebuilt Electron workflow on the supplied graveguard verifies the original
numbered geoset grids in all four editors, existing visibility checkbox, global
clock selection, exact material-layer targeting, actual audio decoding/playback,
event creation, MDX write/reopen, draggable windows, and actual isolated WebGL
mesh draws. Screenshots were inspected; the original model is byte-identical.

The graveguard's MDL conversion already fails verification on ten helper Flags
fields before edits. Edited MDX save/reopen passes, and focused fixtures pass
both formats. Previously reproduced broader Popcorn codec failures and the
signed-time text-parser test expectation remain outside this patch. This does
not claim the full source suite, Warcraft runtime or user acceptance passed.

No release, merge, offline replacement or original-model save is included.
