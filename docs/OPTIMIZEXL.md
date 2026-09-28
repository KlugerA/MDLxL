# OptimizeXL

Open **OptimizeXL** from the existing optimizer toolbar button or command. It opens a separate editor window, using the same detached-window mechanism as UV. The main document is not edited.

## Review workflow

The left viewport is the last approved model; the right is the current proposal. Left-drag either viewport to rotate both; use the wheel to zoom both. OptimizeXL always uses wheel zoom regardless of the main editor's sensitivity-adjustment mode, without changing that saved setting. Pan, animation selection, scrubbing, playback and speed are also shared. Each adjustment is calculated from the last approved model, so lowering strength restores detail rather than simplifying an already simplified candidate.

**Approve** keeps the current proposal. **Skip stage** advances without applying it. Repair stages also have **Skip fix** and **Next stage**. **Back** undoes the last approval or skipped stage. The stage buttons allow returning directly to a particular operation; leaving a stage discards its unapproved proposal.

Selecting a repair finding temporarily jumps to its animation and frame. Leaving the inspection, clearing the finding, skipping it or approving it restores the animation and frame you were viewing beforehand. Camera angle, zoom, speed and loop settings stay unchanged. Switching between several findings retains the original return point. **Back** reopens the undone finding for inspection. Ordinary stage changes keep animations you selected manually.

**Simple** offers a fine strength slider for duplicate merging, animation reduction and polygon reduction. **Advanced** exposes the actual tolerances and protection options. Zero strength performs exact cleanup in the first two stages; zero nuclear strength performs no polygon reduction. Unused-data removal is an exact operation, with individual categories in Advanced.

| Stage | What is proposed |
| --- | --- |
| Duplicate data | Merge compatible complete vertex records (position, normal, every UV channel and bone bindings), duplicate matrix groups and equivalent leaf bones. Advanced supplies position, UV and normal-angle tolerances. |
| Animation optimization | Remove redundant local linear/step keys. Increasing strength permits measured position, rotation and scale differences. Sequence boundary keys stay. Global tracks, spline tracks and non-unit quaternion tracks are retained. |
| Unused data | Remove vertices unused by faces, unreferenced resources, unused bones/helpers and orphan global sequences. Ancestors of used nodes and references from effects and events remain. |
| Insanity FIxer | Run the bundled Hive checker, showing errors, severe findings, warnings and unused notices. Select a supported repair and review it. Initial proposals support static particle gravity and keys beyond global-sequence duration. Other findings stay visible for manual editing. |
| Irregularities Fixer | Offer suspected visibility leaks and standard animation endpoint mismatches. Select each proposal before approving; intentional motion is not automatically rewritten. |
| Sphereomancer | Choose or scroll through collision-sphere presets, scale the group, and edit/add/remove individual spheres in Advanced. Collision overlays appear only during this phase. |
| Nuclear Polygon Destroyer | Reduce triangles with a 0.01%-step strength slider and attribute-aware surface simplification. Advanced exposes target polygon count, shape/texture error budget, UV/boundary, sharp-edge and skinning protections. The displayed KB saving comes from the actual candidate MDX serialization. |

Irregularity proposals cover rare living-sequence appearances of portrait/corpse geometry, body parts reappearing in Decay Bone, Death → Decay Flesh, looping Stand/Walk/Portrait endpoints, Stand Ready → Attack/Death, Attack → Stand Ready, and separately rooted stationary parts during otherwise moving Dissipate sequences. These are review heuristics, not universal rules. Pose repair currently handles local linear and step TRS tracks; it preserves later authored decay keys. Advanced can reverse the reference endpoint.

## Saving: exactly two new files

**Optimize New Copy**, at the top right, is the editor's only save action. It is available at every stage, including while a new preview is being calculated. It asks for an output folder and creates:

- `Model_Before.mdx`: the model as it entered OptimizeXL, including any existing unsaved editor changes.
- `Model_After.mdx`, or `Model_After_NUCLEAR.mdx` when a nuclear stage was approved: the approved result.

Saving includes only approved changes; the current unapproved preview is excluded. With no approvals, both copies contain the entry snapshot. Saving leaves the current stage and proposal open so you can keep reviewing. The same header button remains available after the final stage.

The original and all existing files are protected by exclusive file creation. Occupied names receive a matching numeric suffix. Nuclear does not create a third copy. Both files are verified after writing. A failed save removes only newly created partial outputs. Input MDL is exported as MDX in both copies; sizes refer to MDX, not text MDL or an MPQ-compressed size.

## Current scope and evidence boundaries

- Editable Classic/SD MDL/MDX version 800. HD skin/bind-pose data, unknown sections and trailing data are not supported by this optimizer.
- Hidden-in-one-animation geometry is retained. This version removes unreferenced data; it does not guess that occluded surfaces can never become visible in another animation.
- Approximate animation reduction compares local transform samples against the stage baseline. It is not a proof of a world-space error bound at every possible instant. Skinning, effects and all intended animations still need visual review.
- Nuclear ranks collapses using surface, normal and every UV channel's error rather than edge length. It retains original vertex positions, normals, UVs and bone bindings; it does not reposition vertices. UV seams/open boundaries, sharp edges and skinning boundaries constrain reduction when enabled. It can stop before the requested target and does not promise invisible polygon reduction.
- Nuclear's Advanced **Shape/texture error (%)** is the simplifier's combined relative error budget, including weighted UV and normal differences. It is not a maximum movement distance or a percentage of pixels changed. Simple strength gradually increases this budget from 0 to 20% while reducing the requested target, keeping all protections enabled. The target is a request, not a guaranteed output count.
- The bundled checker is pinned to mdx-m3-viewer 5.12.0 and runs locally without uploading a model. A clean check is not Hive moderation approval or proof of Warcraft runtime behavior.

## Research and preset provenance

[Hive: Collision Shapes, How to Make Your Model Selectable](https://www.hiveworkshop.com/threads/collision-shapes-how-to-make-your-model-selectable.156930/) supplies the standard radius-40 sphere at Z=40 and the tall-unit example with radius-60 spheres and an upper sphere at Z=140. Small/Large are scaled starting choices; Mounted rider uses the three radius-55 spheres from the reviewed Khorne rider. These are editable starting presets, not statistical averages of Hive models.

[Hive: Fixing Faulty Death / Decay Animations](https://www.hiveworkshop.com/threads/fixing-faulty-death-decay-animations.40794/) and [modelling questions and conventions](https://www.hiveworkshop.com/threads/modelling-getting-facts-straight-and-questions.271524/) inform the visibility and continuity proposals. [Blizzard Warcraft III Art Tools documentation hosted by XGM](https://xgm.guru/files/100/344093/comments/545702/Warcraft_III_Art_Tools_Documentation%5Ben%5D.pdf) describes loop endpoints, Ready/Attack/Death pose relationships and the death/decay sequence. Those conventions are prompts for review, not grounds for silently replacing artistic choices.

The [Hive model checker](https://viewer.hiveworkshop.com/check/) uses the [mdx-m3-viewer project](https://github.com/flowtsohg/mdx-m3-viewer). Its unmodified official npm distribution and MIT license are bundled under `public/vendor/` and copied to `dist/vendor/`.

Nuclear uses [`meshoptimizer` 1.3.0's `simplifyWithAttributes`](https://github.com/zeux/meshoptimizer/tree/master/js), with normals weighted at 1 and UV coordinates at 2, `RegularizeLight`, explicit bone/sharp-edge locks, and `LockBorder` when seam protection is enabled. Disabling seam protection permits topology changes across attribute discontinuities; it still includes UV and normal error. The complete MIT license and pinned package provenance ship with the unmodified module in `src/vendor/meshoptimizer-1.3.0/`.
