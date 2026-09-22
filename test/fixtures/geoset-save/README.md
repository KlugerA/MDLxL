# Geoset animation save regression

`Tzeentch_Knight_Max_Reduced.mdx` is an unchanged copy of the user-supplied
`C:\Users\PC\Downloads\Tzeentch_Knight_Max_Reduced (2).mdx`.
SHA-256: `bced442553d8b6fb3c8801f7ba096dbc9a8a0055435b59c67316badcef2edabd`.
The automated test asserts this hash. Never regenerate or repair this fixture.

The video reference is `C:\Users\PC\Downloads\Knight of Tzeench Saving Error.mp4`
(kept at its original location, not duplicated into Git).
SHA-256: `2254ee5a58bf030aba36b6b1944789fb63efda8094305e7fc893b91e0be05364`.
The reviewed recording selects Decay Bone (176667–236667), checks All geosets,
creates missing visibility, changes visibility to zero, and attempts Save As.
The checked-in Electron test replays these controls on a separate working copy.

The fixture contains 48 geosets and 46 GeosetAnim records (GeosetId 0–45).
24 records have disabled tint, static white Color and no KGAC track.
Geosets 46 and 47 need no animation record until an edit requires one.
These facts are not evidence of corruption.

Untouched MDX is byte-exact. Edited MDX changes only GEOA and model counts.
MDL's geoset-color defaults now pass comparison, but this particular fixture's
MDL conversion still fails the independent preservation check on 26 Helper
Flags values: conversion removes bit 0x100. The tests deliberately retain that
failure instead of changing the fixture, weakening flag comparison, or adding
nonstandard MDL fields. See `docs/GEOSET-ANIMATION-SAVE.md` for validation details.
