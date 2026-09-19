# Community requirements for a modern MDLVis + Magos editor

Research date: 2026-09-09. This extends the 2026-09-07 `MDLVis_HIVE_XGM_FINDINGS.md` and `MDLVis_PARITY_CHECKLIST.md`; it does not certify that the application implements the requirements below.

The product opportunity is a single dependable editing session: select geometry, fix its UVs and rig, edit the assigned material and visibility, adjust its nodes and animation, preview the effect, and save without unrelated changes. The old workflow makes users repeatedly change programs, repair text by hand, and test whether saving broke something. Modernizing the interface is useful; making this complete workflow dependable is the larger improvement.

## Evidence and scope

This review uses 25 focused primary community sources: original editor documentation, tutorials written by modelers, tool release notes, maintainer explanations, and first-hand problem reports. Nine sources are hosted on XGM, including the original MDLVis documentation; the remainder are Hive discussions and tutorials. They span original MDLVis-era workflows through an August 2026 tool regression report.

**Verified here** means the linked source was retrieved and contains the described claim. It does not mean a reported engine behavior was independently reproduced. **Reported regression** means a user's or maintainer's observation with a named tool/version/date. **Recommendation** means a proposed design or test derived from those observations. Patch-sensitive behavior needs fixtures and a target game build before becoming an export rule. None of the acceptance rows below is a completion claim.

Several old articles simplify details, and some disagree with each other. Their reliable contribution is often the task users need to accomplish, rather than an exact modern format rule. For example, advice about fixing UVs by splitting geosets shows the need for independent UV selection; it does not prove that geoset splitting is inherently required by the format.

## Material changes since the previous research

1. **The version checklist must include MDX 1200.** A WME maintainer announced support in September 2025 and described a new shadow-intensity field. Treating 1100 as the last known format is already stale. [S10](#s10-current-magoswar3-model-editor)
2. **A 2026 editor can still corrupt unrelated particle tracks.** A WMT user reported `DontInterp` becoming `Linear` during saves involving texture/geoset animation. A material edit must not rewrite emitter timing. [S12](#s12-war3-model-tuner-20242026)
3. **Visibility has more than one source.** Fixing GeosetAnim alpha alone may leave material-layer alpha hiding the same geometry. Users need an explanation of the evaluated result at the current frame. [S19](#s19-hd-visibility-and-texture-compression)
4. **Version number alone does not classify a material as SD or HD.** A 1100 parser bug rejected an intentionally structured SD material, and ordinary resaving could destroy that structure. [S20](#s20-mdx-1100-is-not-a-single-material-layout)
5. **Reforged LODs need deliberate handling.** Historical XGM transplantation examples copy the whole LOD family; a later Hive clarification says lower-detail meshes can be removed in the discussed Reforged builds. Preserve them during ordinary editing, and provide an explicit optimization. [S07](#s07-reforged-transplants-in-rms), [S21](#s21-lod-data-and-optimization)
6. **UV seams are structural.** Duplicate positions may represent intentional seams; position-only welding can damage a wrap. Face-side selection is a practical way to select only one side. [S24](#s24-uv-seams-and-in-game-texture-rewrapping)

## Workflows the editor should make direct

The following are design recommendations, not claims about current implementation.

**Accessory transplant.** Open donor and recipient together. Select the weapon and relevant geosets, choose whether to include lower LODs, preview material/texture dependencies, and select the target bone or one-vertex MDLVis anchor. One operation imports the dependency closure and records a reversible ID mapping. Playback immediately verifies hand motion and visibility. Ordinary paste, preserve-rig paste, and anchor-bound Special Paste must be separate named policies. The donor document and clipboard survive switching documents. [S02](#s02-original-mdlvis-editor-documentation), [S07](#s07-reforged-transplants-in-rms), [S18](#s18-geoset-importexport-as-an-artist-workflow)

**Make this piece visible.** Clicking a geoset exposes editor-only visibility separately from saved geoset alpha and every contributing layer alpha. A small evaluated-state inspector shows the current sequence, frame, static/keyed value, interpolation, and controlling global sequence. It should be possible to set a keyed transition halfway through a sequence without editing raw MDL. Commands that change an entire sequence explicitly say so. [S19](#s19-hd-visibility-and-texture-compression)

**Retexture an existing unit.** Select faces, jump to their material and texture, compare the old and new wrap, project or move the relevant UVs, and retain seams. Material assignment and seam creation should be available in the same session. A split-UV operation must not silently split the rig or reset normals. An import orientation choice should be shown once with a checker preview instead of making users discover an upside-down wrap. [S24](#s24-uv-seams-and-in-game-texture-rewrapping), [S25](#s25-importing-a-new-static-model)

**Author a fire/explosion/ribbon effect.** Create an emitter beneath a chosen parent; edit the emission field in the viewport, segment color/alpha/scale over particle age, atlas rows/columns, and sequence-local emission timing. Preview must distinguish stopping emission from killing existing particles. A burst editor can author Squirt emission keys, but must preserve the underlying track. Ribbon preview needs motion history and material resolution. Mark any unsupported preview domain in the panel that owns it. [S08](#s08-xgm-visual-particle-field-explanations), [S13](#s13-particle-emitter-2-behavior-and-discrepancies), [S17](#s17-model-finalization-nodes-events-and-portrait-cameras)

**Fix game behavior.** Find an attachment or event in a searchable hierarchy, inspect the parent, pivot and inherited transforms, edit its exact name, and preview the affected sequence. Add a collision shape, inspect model/sequence extents, and create a portrait camera from the viewport. Include a small test checklist for the target game; an editor preview is not evidence that sound events, spawned models, selection bounds or portraits work in game. [S09](#s09-xgm-modeling-faq), [S17](#s17-model-finalization-nodes-events-and-portrait-cameras), [S22](#s22-rms-preview-and-preservation-boundaries)

## Prioritized acceptance matrix

P0 means required before recommending the editor for routine modification of valuable models. P1 means required for the intended MDLVis-plus-Magos workflow. P2 means a subsequent productivity/compatibility extension. Every row is a proposed acceptance test. Preservation failures override cosmetic completeness.

| ID | Priority | Scenario and measurable pass condition | Evidence |
|---|---|---|---|
| SAFE-01 | P0 | Open and save untouched MDL/MDX: original supported and opaque data survives; no implicit repairs, renumbering, optimization or target-version downgrade. Unsupported writes stop before replacing the source. | S04, S20 |
| SAFE-02 | P0 | Edit one layer's static alpha, save/reopen: all unrelated keys, interpolation enums, tangents, global references, events and emitter flags are identical. | S04, S13 |
| SAFE-03 | P0 | Open each property dialog and accept without edits: the document stays clean and tuples retain order and precision. | S04 |
| SAFE-04 | P0 | Each model mutation, including drag, material assignment, node clone and batch change, supports one-command undo/redo; cancelled gestures restore prior data. | S01 |
| SAFE-05 | P0 | Save through a validated temporary sibling; interrupted writes leave the last good file recoverable. Autosave recovery never replaces a deliberate source save automatically. | Recommendation from save-loss reports S04, S20 |
| FILE-01 | P0 | Detect 800/900/1000/1100/1200 and unknown versions; show preservation, rendering and authoring support separately for the actual content. | S10, S20 |
| FILE-02 | P0 | Missing textures and unavailable archives produce placeholders and navigable diagnostics while geometry/nodes remain inspectable. | S04, S23 |
| GEO-01 | P0 | Geoset rows expose vertex/triangle counts and assigned material; visible, editable and selected are distinct states. Cross-select a clicked surface in the list. | S02, S11 |
| GEO-02 | P0 | Detach, clone and delete a geoset preserve/remap normals, UV sets, rig groups, material and GeosetAnim references; undo restores identity. | S18, S24 |
| MAT-01 | P0 | Edit ordered classic layers, texture reference, filter mode, flags and static alpha; changing order visibly changes the correct material and no unrelated one. | S16, S17 |
| MAT-02 | P1 | Animate layer texture ID, layer alpha and texture translation/rotation/scale; preserve `TVertexAnimId` and coordinate-set references through both file formats. | S03, S04, S16 |
| MAT-03 | P1 | Selected geoset reports why it is invisible at the current frame, including layer and geoset alpha; editor hiding is clearly independent. | S19 |
| MAT-04 | P1 | Team-color/replaceable-texture preview is selectable; an assigned layer can be traced to its texture and all dependent geosets. | S09, S11, S17 |
| NODE-01 | P0 | Create/clone/rename/reparent/delete bones and helpers; reject cycles and dangling parents; show dependent children and vertex groups before deletion. | S09, S15 |
| NODE-02 | P1 | Clone an emitter with flags, tracks and texture intact; event clones retain the event-identifying name/data. | S04, S17 |
| NODE-03 | P1 | Edit attachments, lights, PE1/PE2, ribbons, events and collision shapes without discarding fields whose preview is unavailable. | S03, S08, S17 |
| RIG-01 | P0 | Every vertex-group reference resolves; binding UI lists eligible bones and explains rejected targets. Imported geometry moves with the selected recipient bone during playback. | S07, S15, S18 |
| RIG-02 | P1 | Classic group-based and HD weighted skinning remain distinct; the UI does not invent arbitrary weights for a classic group or discard HD skin data. | S07, S20; requires codec fixtures |
| PASTE-01 | P1 | Special Paste requires the selected anchor policy; all newly referenced resources and bones are included/remapped; the operation is atomic and reversible. | S02, S07 |
| UV-01 | P1 | Selecting one side of a seam does not select the coincident opposite side. Move/rotate/scale/project/mirror/cancel/undo preserve mesh coordinates and rigging. | S24 |
| UV-02 | P1 | A weld proposal reports UV, normal and binding conflicts before committing; default position-only merging cannot silently remove seams. | S05, S24 |
| UV-03 | P1 | Import a checker-mapped asymmetric model: orientation matches the chosen source convention without a hidden vertical flip. | S25 |
| ANIM-01 | P0 | One timeline controls all domains; exact times and sequence bounds survive; keyed zero values are retained; static properties do not become keys merely from inspection. | S01, S03, S04 |
| ANIM-02 | P1 | Sequence duplicate/retime carries node, geoset, material, texture, emitter and event timing according to an explicit scope; a preview lists changed ranges. | S03, S17 |
| ANIM-03 | P1 | Step/linear/spline tracks evaluate using stored interpolation and tangents. Quaternion preview is compared with trusted fixtures; no automatic spline tangent generation. | S04, S11, S12 |
| ANIM-04 | P1 | Global-sequence users can be inspected; switching local sequence does not reset an unrelated global clock; editing scope is explicit. | S03 |
| FX-01 | P1 | Tail-only, Head-only, both and neither PE2 flag combinations retain their bits in MDL and MDX; preview labels any target-specific interpretation. | S13 |
| FX-02 | P1 | A Squirt test sequence produces the intended burst at keyed time; visibility and emission are independently inspectable. Scrubbing resets/replays simulation deterministically. | S13, S14 |
| FX-03 | P1 | Emitter width/length/parent transforms and negative/positive gravity can be visualized; editing unrelated properties does not swap dimensions. | S08 |
| VIEW-01 | P1 | One-sided, two-sided, normals and textured views expose winding/shading mistakes; camera aspect and selection overlays remain correct on resize. | S05, S06 |
| GAME-01 | P1 | Collision and extents are separate editable structures; calculate-extents is explicit and previewed. Test an edge-of-screen animation and unit selection in the target game. | S09, S17 |
| GAME-02 | P1 | Create a portrait camera from the view; retain external portrait relationship, event identifiers and linked birth/effect paths. | S17, S22 |
| VALID-01 | P0 | Diagnose missing references, malformed indices and cycles precisely. Missing sequence keys and suspicious Squirt values are warnings unless a verified target rule makes them invalid. | S14, S15 |
| OPT-01 | P2 | LOD removal and geoset merging list removed resources and dependencies, are undoable and save to a chosen output; ordinary save never invokes them. | S11, S21 |
| ASSET-01 | P2 | Resolve local folders, MPQ and CASC through named providers with provenance, patch/locale and search order; unavailable providers do not prevent standalone editing. | S07, S11, S23 |
| UX-01 | P1 | At least two models retain independent paths, selection, history and dirty state. Each edit identifies its owning document; closing one cannot save another. | S07, S11 |
| HD-01 | P2 | Preserve HD channels, LOD values, bind data, FaceFX and unfamiliar material payloads before claiming complete HD authoring. | S10, S19, S20, S22 |

## Immediate implementation recommendations

These choices improve an early usable build without requiring every renderer feature first.

1. **Make the inspector connected.** A selected geoset should link directly to its material, layers, textures, GeosetAnim and binding groups. A selected material lists its users. A selected node highlights attached vertices and descendants. Display readable names with stable IDs; do not expose transient memory-like labels as the main identity.
2. **Model an animated property explicitly.** Store its static value separately from its optional track, including interpolation, keys, tangents and global-sequence reference. The editor should never infer `static` merely because one key exists. A static/animated switch must be a deliberate command with a conversion preview.
3. **Introduce dependency-aware transactions immediately.** Clone, delete, detach, reparent, paste and resource renumbering need one shared mechanism, including a before/after snapshot for undo. Otherwise each Magos-style manager will develop different failure modes.
4. **Show capability honestly at the object level.** Use states such as editable, preserved, preview unavailable, and unsupported write. A preserved ribbon is useful even before its simulation is complete; silently removing it is not.
5. **Add three tiny fixtures before expanding the UI:** material alpha plus step emitter visibility; a triangle pair sharing position but different UVs; and two documents whose texture index zero points to different files. These catch unrelated-track rewriting, unsafe welding and cross-document ID leakage.
6. **Keep an evaluated visibility explanation near the selected geometry.** Even a textual value chain is immediately helpful. Do not offer a generic “fix invisible model” command that resets every alpha track.
7. **Make validation severity contextual.** A missing reference is different from a suspicious authoring choice, a renderer limitation, an unavailable texture and a game-specific recommendation. Include target version and exact object/frame in a diagnostic; loading diagnoses without fixing.
8. **Expose only real actions.** If the file dialog offers an export format, it must work or explicitly explain why the selected model cannot be exported. Avoid a menu entry that leads to a “not coded” exception.

## Warcraft constraints versus editor limitations

The editor should remove application restrictions while respecting the selected export target. Triangle-based geometry, referenced resources, sequence times, classic rig groups and versioned HD payloads are part of the file contract. Numeric size limits must be checked against the codec's actual field widths and the target engine; no arbitrary legacy in-memory ceiling should be carried into a new editor simply because MDLVis had it. This research does not establish a universal safe polygon or bone budget for every Warcraft patch.

Some apparently universal advice is tool-specific. The original MDLVis material/global-track UI restrictions do not prove the format cannot express those tracks. Missing boundary keys can be intentional defaults. A model preview's missing birth effect may be an unresolved linked model. Dark geometry may reflect winding or normals instead of an invalid texture. A current engine accepting a specially structured material does not guarantee a third-party converter can regenerate it. [S03](#s03-xgm-animation-domains), [S05](#s05-winding-is-not-fixed-by-two-sided-materials), [S12](#s12-war3-model-tuner-20242026), [S20](#s20-mdx-1100-is-not-a-single-material-layout), [S22](#s22-rms-preview-and-preservation-boundaries)

An export profile should therefore name a game generation/build, preserve data by default, and report any lossy transformation before it happens. Separate “opens in this editor,” “renders here,” “round-trips,” and “tested in the target game.” None implies the others.

## Source ledger and focused findings

### S01 — Complete MDLVis workflow

**Evidence:** The extensive Hive tutorial presents mesh, UV and bone-animation work together, while using other utilities for completion and warning that optimization can produce unexpected results. It supports retaining the fast selection/transform/timeline grammar and treating optimization as a deliberate operation. This was covered in the prior research and remains the baseline.

[Mdlvis: model edition/creation, animation and UV Mapping](https://www.hiveworkshop.com/threads/mdlvis-model-edition-creation-animation-and-uv-mapping.179193/) — community tutorial, 2010-era thread.

### S02 — Original MDLVis editor documentation

**Evidence:** Alexey's documentation explains a current editable geoset with other visible geosets as context, orthographic navigation, work planes, and anchor-based Special Paste. The selected recipient vertex is not just a cursor position: it anchors the imported fragment's animation relationship. This is original product documentation, so it is stronger evidence of intended legacy interaction than later recollections.

[Собственно редактор / The editor](https://xgm.guru/p/wc3/mdlvis_tutorial_2) — XGM, original MDLVis tutorial.

### S03 — XGM animation domains

**Evidence:** The animation guide separates bone, geoset, material, texture and light animation. It describes texture animation as transforming the mapping, including atlas movement and repeat flags, rather than editing pixels. It places non-bone domains in War3 Model Editor's workflow. This supports one shared track editor with specialized value widgets. The prior short XGM article URL failed during this review; the archive thread was retrievable.

[Анимация от «А» до «Я» / Animation from A to Z](https://xgm.guru/forum/showthread.php?p=1112694) — XGM tutorial archive, 2011-era.

### S04 — Magos data-loss history

**Reported regressions:** The 2008 article describes emitter clones losing texture references, texture-animation assignment disappearing on save, and occasional lost emitter animation. Earlier quaternion tuple and static-alpha corruption are explicitly marked fixed in 1.07; they must not be represented as proven current bugs. The useful lesson is to test no-change dialog acceptance and unrelated-property preservation. It also records localization confusion between Unshaded and Unfogged.

[War3 Model Editor 1.07 — Problems and solutions](https://xgm.guru/p/wc3/war3mebugs) — ScorpioT1000, XGM, 21 July 2008.

### S05 — Winding is not fixed by two-sided materials

**Evidence:** This article warns that enabling TwoSided can disguise reversed faces while leaving uneven lighting. Its workflow inspects geometry with a one-sided material and corrects orientation. It also distinguishes MDLVis versions with different preview behavior. **Recommendation:** keep reverse winding, reverse normals, recalculate normals, smoothing and material sidedness distinct; demonstrate the selected operation before applying it.

[Полезные мелочи в работе моделлера / Useful modeling details](https://xgm.guru/p/wc3/useful-modelling-trivias) — reALien, XGM, 2011-era.

### S06 — Normal editing needs diagnostic lighting

**First-hand report:** A user repeatedly adjusts tree normals because MDLVis, World Editor and the game shade them differently, including during a falling animation. The accepted explanation distinguishes normals from surface color. **Recommendation:** provide normal vectors, a simple rotating-light preview and a material-color view, with clear labels; save must not “normalize” intentional edits.

[Нормали в MdlVis / Normals in MDLVis](https://xgm.guru/p/wc3/257707) — XGM, 13 January 2021.

### S07 — Reforged transplants in RMS

**Evidence:** The HD tutorial transfers animations between closely related rigs and replaces a weapon by selecting its geosets/LOD variants, copying across models, then reassigning its matrix to the recipient weapon bone. It warns that dissimilar skeletons require more correction. Later comments reveal difficulty locating geoset visibility and camera controls. The article's speculation about engine LOD usage is superseded by the clarification in S21.

[Основы работы с Retera Model Studio / RMS basics](https://xgm.guru/p/wc3/retera-model-studio-basics) — DarkLigthing, XGM, 11 September 2020, plus later comments.

### S08 — XGM visual particle-field explanations

**Evidence:** Illustrated examples show PE2 width/length turning a point source into a line or rectangle, and positive/negative gravity altering motion. Both dimensions and gravity are animated properties. **Recommendation:** draw the actual emission region and parent axes, and expose editable curves beside the effect preview; textual width/length fields alone leave too much guesswork.

[Источники частиц [Particle Emitter 2]](https://xgm.guru/p/heavens-gallery/particle-emitter-2) — Heaven's Gallery, XGM, 2017-era.

### S09 — XGM modeling FAQ

**Evidence:** Repeated practical tasks include fixing edge-of-screen disappearance with extents, creating collision shapes, adding timed sound/footprint/blood events, setting attachment/turret-related bone names, and changing team-color materials. These are game-facing model operations, not optional decoration in an editor. Some old advice is a workaround for historical tools and must not become a universal modern validator rule.

[Моделлинг FAQ / Modeling FAQ](https://xgm.guru/p/wc3/mfaq) — XGM, 15 August 2008, maintained article.

### S10 — Current Magos/War3 Model Editor

**Verified maintainer statement:** On 5 September 2025, BogdanW3 announced WME 1.09 support for MDX 1200 and a shadow-intensity field. The page lists an experimental 64-bit 1.09.1 binary alongside 1.07. This makes modern Magos maintenance relevant; “Magos means unchanged 2008 code” is inaccurate. The exact 1200 schema still requires source/fixture verification before writing it.

[War3 Model Editor, page 27](https://www.hiveworkshop.com/threads/war3-model-editor.62876/page-27) — maintainer release discussion, posts 1301 onward, 2025–2026.

### S11 — RMS capability and limitation baseline

**Author release notes:** RMS offers MPQ/CASC browsing, team colors, geometry selection modes, UV editing, editable-geoset control and animation tools. The historical feature text warns about incorrect spline tangents in experimental animation editing and static snapshots discarding node information. The page was updated in February 2026, but individual bullets describe different releases; they are not a tested inventory of one current binary. Use these as regression prompts, and record the exact comparison build.

[Retera's Model Studio](https://www.hiveworkshop.com/threads/reteras-model-studio.316000/) — author tool page, created 2019, updated 23 February 2026.

### S12 — War3 Model Tuner, 2024–2026

**Evidence:** Its changelog includes dependency-complete geoset interchange, per-sequence visibility, tangent editing and incremental undo. It later withdraws missing-sequence-entry errors because engine defaults can be valid. **Reported regression:** Dartz's 19 August 2026 post says saving can change step emitter visibility/emission tracks to linear and cause leakage into other sequences. The top feature list and later changelog disagree about undo breadth; do not assume either is a full current capability audit.

[War3 Model Tuner v1.5](https://www.hiveworkshop.com/threads/war3-model-tuner-v1-5.357550/) — stan0033, created December 2024, updated 13 August 2026; report at post 42.

### S13 — Particle Emitter 2 behavior and discrepancies

**Evidence:** This specialist tutorial distinguishes visibility from emission, burst timing, particle-age segments, model-space effects, and game/editor discrepancies. It reports MDLVis's MDL output converting tail-only emitters to heads while MDX preserves them. Some observations explicitly require game testing; the emission-frequency estimate is marked uncertain. **Recommendation:** retain raw flags and track semantics and create separate MDL/MDX particle fixtures; do not treat a Magos preview as the renderer oracle.

[Particle Emitters 2](https://www.hiveworkshop.com/threads/particle-emitters-2.329335/) — Vinz with credited community research, Hive, 18 December 2020 and updates.

### S14 — Sanity-tester author's warning semantics

**Author explanation:** The June 2021 update adds warnings for suspicious Squirt configurations and uncertain XYQuad edge cases. The low-rate threshold is explicitly a heuristic for likely mistakes; it is not a format-validity boundary. Broken BLP mipmaps are another independent failure source. **Recommendation:** preserve the warning/error distinction and report texture decoding separately from model parsing.

[Mdx sanity tester](https://www.hiveworkshop.com/threads/mdx-sanity-tester.290476/) — GhostWolf, Hive; especially post 49, 2 June 2021.

### S15 — Repair-oriented sanity guide

**Evidence:** The guide covers missing bone bindings, invalid IDs/parents, sequence problems and unavailable particle resources. It translates abstract diagnostics into repair tasks. The modern editor should navigate from each report to the exact object, vertex group or timeline location. Existing problems should be inspectable before any proposed fix; passing a community checker is useful evidence, not a substitute for target-game verification.

[How to fix errors by HIVE's Sanity Checker](https://www.hiveworkshop.com/threads/how-to-fix-errors-by-hives-sanity-checker-make-your-model-pass-the-sanity-check.349727/) — Hive repair tutorial, 2023-era.

### S16 — Animated texture IDs

**Evidence:** The tutorial creates a water animation by adding multiple texture resources, assigning them through a material layer and keying that layer's texture ID. This is distinct from moving a single texture's UV transform. A modern material editor needs both operations, with texture thumbnails and integer-valued texture-ID keys so they cannot be confused with a smooth alpha curve.

[Animated Textures Tutorial](https://www.hiveworkshop.com/threads/animated-textures-tutorial.158421/) — Hive, 2010-era.

### S17 — Model finalization: nodes, events and portrait cameras

**Evidence:** The guide's finalization stage includes layered/team-color materials, node types, timed sound/footprint/blood/ubersplat events, extents and portrait cameras. It describes creating a camera from the current view and the separate `_Portrait` companion convention. Events need game testing because Magos does not play them. **Recommendation:** preserve exact event identity, provide a camera-from-view command, and include finalization tools beside mesh and animation editing.

[Modeling and Animation 101](https://www.hiveworkshop.com/threads/modeling-and-animation-101.41840/) — Hive tutorial, 2007-era.

### S18 — Geoset import/export as an artist workflow

**Evidence:** The tutorial combines a Footman's head with a Rifleman using exported geosets and material/bone assignment. Replies report a transplanted piece moving toward the wrong point in animation despite looking correctly positioned in the editor. **Recommendation:** transplantation acceptance requires playback and binding checks, not only a correct rest pose.

[Geoset Importing and Exporting Guide](https://www.hiveworkshop.com/threads/geoset-importing-and-exporting-guide.181697/) — -Peper-, Hive, 30 October 2010.

### S19 — HD visibility and texture compression

**Maintainer diagnosis:** A modeler's parts disappear despite adjusting GeosetAnim; Retera identifies a second visibility source in material layers. The thread also distinguishes DDS compression appropriate to different HD texture roles. **Recommendation:** display both alpha sources together; show texture role/format metadata and validate intentionally rather than blindly converting files. DDS advice here is historical community guidance, not a claim that every patch requires exactly one compression setting.

[Problems: Normal map looks glossy and Geoset Visibility](https://www.hiveworkshop.com/threads/problems-normal-map-looks-glossy-and-geoset-visibility.350666/) — Stonebreaker, Retera and Symphoneum, Hive, August 2023.

### S20 — MDX 1100 is not a single material layout

**Maintainer report:** Retera demonstrates an SD Tidal Guardian variant using 1100 material structures that an updated parser misclassifies. He clarifies that multiple texture assignments within a layer differ from multiple layers, and warns that existing RMS saves lose the crafted binary structure. **Recommendation:** parse by schema and actual fields, preserve unfamiliar substructures, and avoid regenerating a whole material from an oversimplified inspector object.

[Bug in the MDX 1100 parsing by ThompZon and Twilac](https://www.hiveworkshop.com/threads/bug-in-the-mdx-1100-parsing-by-thompzon-and-twilac.349270/) — Retera and ThompZon, Hive, 29–30 May 2023.

### S21 — LOD data and optimization

**Evidence:** The discussion asks whether repeated HD meshes are actually used. In March 2021, Kam clarifies they can be removed to save space; later discussion distinguishes mesh count from other load/performance costs. This is stronger evidence for the discussed builds than the earlier XGM explanation. **Recommendation:** offer a selected-LOD removal command with size/dependency impact; do not silently strip them or promise identical behavior on every future patch.

[Why do Reforged models have 4 copies of all mesh?](https://www.hiveworkshop.com/threads/why-do-reforged-models-have-4-copies-of-all-mesh.327175/) — Hive, September 2020–October 2021.

### S22 — RMS preview and preservation boundaries

**Author explanations:** RMS may not display a building birth model spawned through an external model path. A changelog explicitly mentions preserving FaceFX during component deletion. Another reply explains that an OBJ save option existed despite export being unimplemented. **Recommendation:** test linked assets and opaque data during component operations; make unavailable previews and exports visible before users depend on them.

[Retera's Model Studio, page 13](https://www.hiveworkshop.com/threads/reteras-model-studio.316000/page-13) — author replies and changelog, including May and October 2024.

### S23 — Archive compatibility is independent of model editing

**Author/library-maintainer explanation:** Older and newer CASC TVFS layouts diverged without the expected version increment, breaking data-source loading. This is an archive-provider issue, not necessarily an invalid model. **Recommendation:** make providers independently diagnosable and patch-aware; standalone files should remain usable when a game installation cannot be indexed.

[Retera model studio can't find warcraft data](https://www.hiveworkshop.com/threads/retera-model-studio-cant-find-warcraft-data.339158/) — Retera and Dr Super Good, Hive, April 2022.

### S24 — UV seams and in-game texture rewrapping

**Practitioner explanations:** Users detach pieces, assign materials in Magos, then rewrap in MDLVis. Later replies describe projection and selecting faces to isolate one side of duplicated-position UV seams. An earlier claim that MDLVis cannot reproject is contradicted in the same thread. **Recommendation:** retain projection, seam-aware selection and material assignment directly; provide a deliberate merge policy instead of welding all coincident positions.

[Wrap up Model with ingame Texture s](https://www.hiveworkshop.com/threads/wrap-up-model-with-ingame-texture-s.255041/) — Hive, July 2014.

### S25 — Importing a new static model

**Historical workflow:** The tutorial cannot start a new MDLVis model, so it deletes a donor down to one vertex, imports 3DS, removes the anchor, fixes a flipped UV map, then changes programs to assign textures/materials. These workarounds are excellent targets for removal. **Recommendation:** support a genuinely empty document, direct material setup and an explicit import-coordinate/UV convention.

[Как создать неанимированную модель для WarCraft III в 3DS Max любой версии](https://xgm.guru/forum/showthread.php?page=1&pp=20&t=21924) — XGM tutorial archive, 2009-era.

## Follow-up research with the highest implementation value

After the initial application works, gather small, redistributable fixtures for the exact failures above: tail-only PE2, a step emission track beside texture animation, a UV seam with distinct normals, a visibility conflict, a 1100 multi-assignment material, 1200 shadow intensity, a FaceFX-bearing model, a linked building birth, and an HD rig with LOD variants. Record the author, license/permission, source, target patch and expected semantic result with each fixture. Prefer synthetic minimal fixtures when the failure can be reproduced without distributing game assets.

Inspect actual current binaries or source before declaring feature parity with RMS, its Twilac fork, WME 1.09.1 or WMT 1.5. Tool-page update dates do not make every historical warning current. The next research pass should turn uncertain rendering behavior into reproducible target-build comparisons, then add each confirmed case to the acceptance matrix rather than accumulating a longer untested feature list.
