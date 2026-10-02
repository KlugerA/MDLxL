# Citadel native painting audit and design

## Reference observations

Local Longbowman Blacksmith Speedpaint, 20:56.97, 1280×720/30fps. Viewed broad contact sheet across the video plus exact sequences at 1:16/18/20/22, 8:42/44/46/48, and 15:50/52/54/56. These show short strokes followed by smudge passes, painting in either the model or flat texture, rapid orbit/zoom inspection, and persistent texture-set/brush/layer context. The texture is never merely a library thumbnail: it is the live other view of the same work.

## Proven baseline

Base `9e9a41c` running tracked v0.16.0 dist in an isolated profile, unchanged `Downloads/Footman (Original).mdx` (MDX800). Installed native Footman/Grunt/Blacksmith are MDX1800, outside Citadel's existing entry gate; they were extracted read-only and were not repaired or converted for proof. The repository's Tzeentch Knight MDX800 fixture also opens the baseline Paint workspace.

- Current Skin and New basecoat are distinct; setup defaults to a new blank coat.
- Model and texture views alternate. Flat view is hidden/unmounted when painting in 3D.
- Destination labelled Material, separate source labelled Texture, while Use for whole model remains prominent. Native library is hidden beneath Library options.
- Current Skin resamples all sources into global 256/512 square rasters. Missing source images silently become neutral primer.
- `enablePaintMaterials` / `materialTemplate` retain only the first static image plus some preceding team-colour layers, removing other source layers from the working view. Original source bytes remain separate but this is not appearance preservation.
- Fresh cropped imagery uses exactStamp projection, but the held cursor is an undistorted DOM image. Actual projection selects destination texels, including repeated/mirrored/degenerate UVs, so that overlay cannot predict the visible result.
- Texture brushing samples imagery relative to each dab and averages along movement. Repeated dabs smear and slide details. ExactStamp is also repeated along a drag with flow reduction.
- Projection cache retains a map for every camera pose. Preparing surfaces includes full UV coverage, depth and seam work; cold cost and warm responsiveness must be distinguished.
- Existing fresh UV atlas is only created during blank setup/new blank material. It appends a UV set, duplicates seam vertices with rig streams and leaves prior UV sets available. No per-stroke rewrapping occurs.

Baseline captures initially live in the task visualization folder and will be copied into `out/citadel-audit`. `baseline-color-timing.json` measures renderer pointermove to two animation frames, not physical input-to-photon. First stroke included a 177 ms long task; warm frame samples were about 5–6 ms on this machine. Repeat the same protocol after changes and report bounds accurately.

## Chosen interaction

Keep both views in the existing center column with an adjustable split; preserve outer sidebar widths and shared camera controls. Label destination and source distinctly. Current Skin defaults to preserving authored pixels, dimensions, layers, UV sets and material properties. Show live coats in the existing sidebar.

Native source recipes (path, reference dimensions and rectangle provenance) form the starter shelf; load their pixels from the configured game data. No synthetic replacement assets or fabricated native substitutes. Full native library remains directly accessible during the session. Cropping returns to the same target, camera, coat and undo history. Whole-image and cropped sources support an explicit Brush/Detail application choice: anchored repeating strokes versus one movable, mapped placement per gesture. Use the same CPU texel projection and compositing for held preview and commit.

Current-skin setup and ordinary colour painting retain authored mappings. The user's follow-up video, `electron_21lGSOeZ8X.mp4` (15.06 s), exposes the limiting case: the shield has mirrored faces sharing a small skin region. A faithful projector alone still produces noise because different screen pixels compete for the same destination texels. The required first placement must be recognizable without making the user find that tiny region or prepare UVs first.

For 3D imagery, stage independent 1024-pixel paint space using the existing atlas owner before the first hover. Reproject the base, every coat and alpha mask; preserve other layers' UVs and rig streams. Render only the temporary proposal until the user paints. Commit mapping and pigment together as one undo step. Subsequent strokes reuse the prepared space. A destination-texel screen-footprint calculation raises image scale at close camera distances when needed to keep the source readable. Preview and commit use exactly the same effective scale. The displayed brush size remains the requested coverage for repeating brushes; a Detail outline follows its actual placement dimensions.

Face regions and destination pixel masks restrict placement; pixel masks transfer with the temporary mapping. Keep the explicit surface preparation dialog for later resolution/UV adjustments. Unsupported animated UVs, malformed vertex streams and operations exceeding the undo budget report an error before canonical mutation. These cases are not silently converted.

Retire all old stock images and seeding. Remove old disk copies only at known seed paths whose SHA-256 matches the shipped source; modified, renamed, personal and project files survive. Keep traceable CC0 brush masks, which are not the retired texture collection.

## Verification boundary

Focused geometry/raster/history/preservation regressions plus rebuilt Electron pointer workflows on flat/curved/seamed/shared UVs, texture switching, native crop selection, ordinary colors, repeated coverage, orbit, undo/redo, preset and model save/reopen. Use isolated profiles and unchanged source fixtures. Screenshot comparison proves rendered output; automated checks do not establish the AFK user's acceptance or native Warcraft runtime fidelity.

See [VERIFICATION.md](VERIFICATION.md) for current measured results and remaining limits. Native source images and the supplied models stay in ignored local evidence directories, outside the PR.
