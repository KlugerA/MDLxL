# Citadel Paint remake

## Product direction

A compact, responsive model-painting editor for Warcraft III SD: easy to learn
by playing, capable of reskinning a model through images, cutouts, brushwork and
colors. The emitter editor is the usability benchmark. The user explicitly
requested a Paint UX redesign; other editors and their camera conventions stay.
The prior Autoaim controls and automatic whole-model repacking were rejected.

Reference: `C:/Users/PC/Downloads/videoplayback (1).mp4`, the 20:56 Longbowman
Blacksmith speedpaint. The four latest ShareX videos (ZuTXTPtO4l, Za6T1klWuK,
qUUB52hElS, z3ENpFEnAs) show the user's real brush, basecoat, blend, cutout,
shared-UV and navigation problems. Their feedback supersedes held-stamp Apply
and the old five-tool toolbar.

## Current interaction

1. Open Paint and choose **Edit the texture** or **New base coat**. The model,
   live texture and image shelf remain together. The divider resizes the views.
2. Main tools are **Paint B**, **Stamp T**, and **Erase E**. Blend D and the
   eyedropper I are brush options. Part selection remains available in every
   tool: Shift adds, Ctrl subtracts; Q temporarily selects without a brush.
3. Pick a color and press **Related colors C** for nine shades with the exact
   chosen midtone, warm shadows and pale highlights, plus a continuous gradient.
   Round, Soft, Pencil, Chisel and Speckle have visible shape previews and keys
   4-8. Even a one-pixel brush retains a black/white crosshair.
4. Blend has its own strength, initially 15 percent. A stroke blends from its
   initial pixels and caps accumulated coverage at that strength. Overlapping
   dabs cannot silently build to full strength. Shift+[ / Shift+] adjusts
   softness or Blend strength; plain brackets adjust brush/stamp size.
5. Blank coats start with **Shade H**, a view-only camera-relative light that
   reveals form even on unshaded Warcraft materials. **Outlines O** and
   **Colorfy Y** distinguish connected parts without altering model or pixels.
   Colorfy still permits picking. Original F6 and Frame Home remain immediate.
6. Choose one of five native starter sources, WC3 library J, From file
   Ctrl+Shift+O, or the user's own library. Cut rectangle/ellipse/lasso/polygon/
   wand selections. Wheel zoom and middle/right-drag pan work while selecting.
   Keep saves a PNG to the user's library; imported cutouts retain exact RGBA.
7. **Click to stamp, repeat immediately.** The cursor shows an image ghost;
   while pressed, the real mapped preview can be dragged. Release commits one
   undo step. Escape cancels a pressed stamp. There is no Apply confirmation or
   held-placement instruction panel. Comma / period rotates 15 degrees; M mirrors.
   Hold R to begin outside the edge; selected geometry and protected pixels still clip paint.
   Full image 1, Texture 2 and Highlights 3 are direct buttons. Texture borrows
   light/dark detail into the painted color; Highlights adds bright detail.
8. Select connected Part P, Geoset G, or Faces F by clicking/dragging across
   geosets. Shift adds and Ctrl subtracts. Selection survives tool changes.
   Isolate L, Clear Ctrl+D, Invert Ctrl+I and Fill Shift+F stay in Paint.
   **Protect pixels X** supplies detailed destination masks; Pixels S selects
   rectangles directly in the bottom texture. Shift/Ctrl modify those masks.
9. **Copy Ctrl+C / Paste Ctrl+V / Mirror M** reuses painted selections as
   stamps. With no selection, Copy opens the patch cutter. Ctrl+Shift+C always
   opens it. Ctrl+X copies the composite and erases the active coat only, leaving
   the original skin beneath it. Global editor clipboard buttons route to Paint.
10. **UVs U** enables in-place movement, scaling, rotation and mirroring of the
    selected faces. Shared boundary vertices are duplicated through the mesh
    stream copier, preserving unselected UVs and every rig/vertex stream. UV
    edits are undoable and survive portable-project and model save/reopen.
11. **Separate this part Ctrl+J** gives the active selected part independent
    texture pixels without splitting geosets. Copy its current strip beside
    the complete original skin, with gutters. Reuse empty canvas/private UVs.
    Compressed axes gain nearest-copy pixels; the area-weighted median prevents
    a tiny sliver from inflating the whole selection. Constant-point UVs get
    local charts filled with their previous color. Undo restores the old state.
12. Wheel zoom follows the pointer in both image views. Right/middle drag pans;
    0 fits the destination. Alt-drag rotates the model using the shared camera
    controls. Green key labels accompany commands; ? opens a dismissible guide.
    Layers and destination controls remain collapsed. Save project, Export,
    and Use paint keep their separate persistence paths.

## Pixel and performance rules

- Existing skins default to a 512-pixel working copy, nearest-scaled only when
  smaller. Authored layout, aspect ratio and source files remain. Hidden corpse
  targets stay native. Native and 1024 working resolutions remain available.
- Blank base coats intentionally create a fresh paint mapping and solid RGBA
  color. View shading is never baked into the texture.
- Stamp source coordinates come from destination texel centers. Filter and
  magnified-screen samples are fallbacks and must not drag source imagery
  toward the stamp center. Pressed preview and release use the same projector.
- Compatible RGBA8 PNGs use the lossless project decoder; browser canvas
  premultiplication must not round feathered cutout colors on reuse.
- Hover moves only the visible cursor. It performs no per-texel projection.
  Projection caches tolerate floating-point camera roundoff while real camera,
  viewport, model, UV or selection changes invalidate them. Geometry visibility
  still uses exact depth, not an approximate low-resolution depth image.
- UV triangles and seam footprints are clipped conservatively per scanline;
  exact barycentric/distance tests decide coverage. Parity tests compare every
  sample against the previous rectangle scan, including wrapping and padding.
  Screen tiles are lazy and reused across gestures. Dirty rows limit compositing
  and upload work. Transparent preview allocation avoids redundant zero fills.

## Evidence boundaries

Shared authored pixels still share paint until explicitly separated. A collapsed
UV or subpixel strip cannot encode a rich image while retaining that mapping.
The local selection-space action handles compressed axes and constant points;
it does not promise arbitrary mixed/line-degenerate unwrapping. Exact preservation
is tested with nearest filtering. General linear-filter parity is unestablished.

The saved Footman study is a reproducible quick reskin exercise, not a polished
asset or a novice completion-time claim. A complete Ghoul/Abomination-skin reskin,
user acceptance and native Warcraft runtime playtest remain unexercised.
Paint controls and guidance are localized in English, Russian, Spanish, Chinese
and the existing Mordor cipher. Existing scene/view data remains readable;
the visible editor focuses on painting.
