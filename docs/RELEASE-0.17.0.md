# MDLxL 0.17.0 - Paint, stamps and selections

Paint is rebuilt around Warcraft III SD models: choose the existing skin or a clean base coat, pick a part, then paint or borrow imagery from Warcraft and your own files.

- Stamp repeatedly without a confirmation dialog. Cut a patch, resize it, rotate with comma/period, mirror with M, then click or drag to place.
- Hold R to start a large stamp or brush beyond the edge. Paint still respects the visible surface, selected geometry and protected pixels.
- Clearer polygon/freehand selection, numbered polygon corners, a live closing edge, and visible selected/protected areas.
- Five brush shapes, related color palettes, controlled blending, tiny-brush crosshairs, and direct Full image / Texture / Highlights buttons.
- Shift adds parts; Ctrl subtracts. Copy/paste painted patches, isolate parts, show outlines or view-only part colors, and adjust UVs without leaving Paint.
- Separate a selected part's texture pixels when shared UVs cause another part to change.
- Five native starters, a personal texture library, and source/destination wheel zoom and panning.
- Paint translations in English, Russian, Spanish, Chinese and Mordor mode. English and Russian two-page guides are included in the ZIP under resources/app/docs and as separate release downloads.
- Grabthrough starts **on in Vertices** and **off in Bones**, with independent toggles.

Save a paint project to keep its layers. Use paint on model applies the result to the editor; save the model normally afterward. Export creates a Warcraft package.

Native Warcraft sources use your configured game data. First placement can pause while the projection is prepared; repeated placements reuse it. Existing original skins and source files are retained.

Includes the EMTR ribbon and NormalsXL fixes from 0.16.1.

The portable EMTR library runtime is now bundled as part of the build, preserving the installed library hotfix without requiring development dependencies.
