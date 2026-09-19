# MDLxL 0.11.0

Warcraft III model editor. This source continues the requested MDLVis rebuild lane, with the MDLxL name and icon.

For the Windows release, extract the whole ZIP and run MDLxL.exe. Keep its resources, Backgrounds, BitsAndParts and Addons folders together.

For source development, use Node.js 20 or newer. Install the pinned dependencies with npm ci, run npm test, then npm run build. Run npm start for Electron or npm run dev for browser development. After building, npm run package creates the Windows package with the MDLxL icon.

The source archive includes docs/MDLxL-Guide.txt and earlier release notes. See THIRD_PARTY_NOTICES.md for component credits.

Version 0.11.0 restores the repeatable F texture/wireframe toggle, corrects animated
MDX geoset RGB, and lets UV Highlight Select shrink to 25%. Forge now retains
geometric crops, produces low-count Rough meshes and exterior trim with signed
depth offsets, and supports Square, Circle and Triangle crops. Optimize Model
(red-plus toolbar icon) previews verified byte savings and applies one undoable
change. Windows GIF recording uses bundled FFmpeg with lossless temporary frames,
a shared palette, accurate recorded timing and Retry Save. The external FFmpeg
corresponding-source archive accompanies the release for redistribution.

Version 0.10.3 separates final-model previews from editing overlays. UV preview
has independent Show mesh, Highlight Select and Size controls. Animations and
other final-model previews use textured presentation with authored geoset color.
Settings > Warcraft III > Preload Assets prepares persistent local thumbnails for
the available texture library, with confirmation, progress and cancellation.
Importing continues to use original native texture paths and original bytes.
See docs/MDLxL-0.10.3-Changes.md for usage and cache scope.

Version 0.10.2 implemented HerrDave's September 10 contract: independent grids and
axes, consistent team color and lighting, sharp viewport edges with filtered
textures, 3D rig markers, compact Bones/Movement controls, rest-pose pivot editing,
selection-scoped UV maps and mesh copy/paste, workplane and movement locks, and
the updated toolbar, View menu and light theme. Bones replaces UV Wrapper;
UV-maps opens from an eligible vertex selection. The approved lighting setup
remains ambient 128, diffuse 192, specular 0, power 1. The release review bundle
contains the ticket checklist, comparison images, exact test results and limits.

This patch restores a compact, 52-pixel MDLVis-style keyframe reel in Movement
and Animations. It shows the current sequence, or the All line for local time.
Highlight KF restricts editing to selected objects and their active controller.
Ctrl+C copies stored keys, C copies the sampled frame, and Ctrl+V pastes whichever
was copied most recently. Shift selects an inclusive range. Delete removes keys
at the current time or selected range; Edit > Keyframes > Clear removes the selected range
or all keys in the displayed interval. Drag the reel bar to scrub; click the
bottom ruler to jump to the previous or next key. See docs/MDLxL-0.10.1-Changes.md.

Forge, shared DummyBone attachment, general geoset shaping, English/Russian
switching, viewport improvements and capture controls from 0.10.0 are retained.
