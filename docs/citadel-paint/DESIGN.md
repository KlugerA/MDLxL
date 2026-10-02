# Citadel Paint remake

## Product direction

The current request replaces the earlier Autoaim direction. Build a compact,
responsive model-painting editor for Warcraft III SD: easy enough to understand
by playing, capable enough to reskin an entire model with imagery, cutouts,
brushwork and colors. The emitter editor is the usability benchmark. Keep the
existing main editor and shared camera conventions.

The reference video is the local Longbowman Blacksmith speedpaint,
`C:\Users\PC\Downloads\videoplayback (1).mp4`, 20:56.97 at 1280x720/30fps.
Viewed sequences show short strokes followed by blending, painting in either
model or texture view, fast orbit/zoom, and persistent sources and layers.
The feedback recording `electron_21lGSOeZ8X.mp4` shows the shield's small UV
allocation producing poor direct stamps. The automatic whole-skin atlas and
later Autoaim UI were both rejected; neither is the new workflow.

## Current interaction

1. Open Paint; choose **Edit the texture** or **New base coat** and its color.
2. Paint, Stamp, Blend, Erase, and Select are the five main tools. The model and
   live texture remain together, with an adjustable divider.
3. Color painting has size, opacity, softness, swatches and an eyedropper.
   Blend carries pigment between visible selected pixels. Erase removes marks
   from the active paint layer, retaining the original skin beneath it.
4. Choose one of five native starter sources, open the Warcraft library, or
   import an image. Cut rectangle/ellipse/lasso/polygon/wand selections. Small
   images open enlarged. Keep saves a PNG to the user's own library; Copy a
   patch grabs the current painted texture for another stamp.
5. Stamp holds a real mapped preview until Apply/Enter or Cancel/Escape.
   Drag to move; adjust size, opacity, rotation and horizontal flip. Full image
   borrows source colors, Texture only borrows light/dark detail while retaining
   the painted color, and Highlights only adds the bright source detail.
6. Select a connected piece, a whole geoset, faces by dragging, or pixels on the
   texture. Shift subtracts faces. Selection survives switching tools; isolate
   and color-fill remain in the same editor.
7. Shared texture pixels can be deliberately made independent. Copy the
   selection's existing strip beside the complete original skin, with gutters;
   do not pack the entire model into new charts. Duplicate boundary vertices
   through the mesh editor's stream copier; preserve positions, normals,
   binding streams, other UV sets and geoset count. Undo restores the old state.
8. Layer and destination controls are collapsed. UV adjustment is a deliberate
   toggle. Resize texture preserves layout and aspect ratio. Save project,
   Export, and Use paint remain separate existing persistence paths.

## Pixel and performance rules

- Existing skins default to a 512-pixel working copy, nearest scaled only when
  smaller. The authored arrangement, aspect ratio and source files remain.
  Hidden corpse targets stay native. Texture detail offers Native for exact
  pixel work and 1024 for finer work. This is a working-copy resolution choice,
  not a per-stamp camera compensation or automatic UV repack.
- Blank base coats use the existing fresh paint mapping and explicit solid RGBA
  color. That mode intentionally creates a new paintable skin.
- Stamp source coordinates come from destination texel centers. Seam gutters
  and magnified screen footprints are fallback samples; they must not pull
  source imagery toward the stamp center. Preview and Apply use the same code.
- Compatible RGBA8 PNGs use the lossless project decoder. Browser canvas
  premultiplication must not round feathered cutout colors during reuse.
- UV seam coverage clips each scanline to the edge's actual filter footprint.
  Exact depth lookup uses small screen bins. The cache is bounded by current
  pose/selection, and screen tiles are generated only near a gesture.

## Limits and remaining design work

Automated UI coverage is not the user's acceptance. A mathematically collapsed
UV or a subpixel-wide strip cannot encode a detailed picture while retaining
that mapping. Shared pixels still share paint unless explicitly separated.
The synthetic stretched/collapsed tests prove coverage and preview/history
consistency, not attractive artwork. Do not claim arbitrary UV fidelity from
those tests. The independently selected Footman shield has a visibly usable
chainmail preview; unrestricted stamping can still affect shared authored UVs.

Continue improving these limits based on actual images and model preservation,
without bringing back the rejected global atlas or adding Autoaim controls.
No native Warcraft runtime playtest has been performed. New visible strings
are currently English. Other existing scene/view data is retained when opening
projects, but the remake intentionally focuses its visible controls on painting.
