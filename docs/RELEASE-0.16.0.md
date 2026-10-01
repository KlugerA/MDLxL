# MDLxL 0.16.0

This release adds model tabs and combines the latest editing, paste, selection, and UV fixes.

- Open models have their own tabs, with editor selection and view state retained per tab. Only the active model's viewport is mounted.
- Copy geometry or nodes with Ctrl+C, switch model tabs, and paste with Ctrl+P or Ctrl+V. Geometry receives the RGB settings from the selected RGB Preview.
- Ordinary pasted geometry attaches to a validated DummyBone. Copied node roots use the same attachment system. Existing node identities, pivots, tracks, parents, and geometry bindings are preserved when nodes are added. BitsAndParts and Forge share the corrected DummyBone handling.
- Subsequent model-file launches are routed to the existing MDLxL window as tabs. Open additional files sequentially; opening multiple files together on the very first launch remains a known verification gap.
- Small edits on animation-heavy models no longer repeatedly build full-model JSON dirty fingerprints or send two complete animation graphs through the recovery bridge. Animation data is retained, and undo/redo, save verification, and legacy recovery remain supported.
- With Grabthrough enabled, occluded vertex markers are drawn through Textured View in both Vertices and Bones. The default remains off; Surface/Wireframe behavior and the global X-Ray preference are unchanged.
- Project from Current View keeps the selected UV island centered on its existing UV position. Camera rotation and zoom control projection orientation and scale; panning no longer moves the UV island. Unselected UV coordinates are unchanged.

MDLxL 0.16.0 includes every change released in 0.15.2.
