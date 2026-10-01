# MDLxL Particle Editor — implementation contract v1.2

Prepared 30 September 2026. Refined for Astra's implementation handoff. This contract supersedes drafts 1 and 1.1 where they differ.

**Required workflow:** **Open Particle Library → choose a well-named visual effect → experiment → save a preset or add to model.** The entry point is the effect, organized by appearance. Source units are optional provenance and search aliases. Astra must implement and run extraction against the user's configured local CASC assets; the user need not export emitters one by one. This document does not claim that extraction or a fresh repository audit has been performed.

**Product statement:** Open a visual library of clearly named particles, choose one by its appearance, touch what you see, change it immediately, and save it or place it on a model. Source units are optional provenance, not a navigation requirement. Classic and Clueless are two interfaces to the same Warcraft data—not two particle engines.

This is an implementation contract, not a claim that the feature exists. The user's stated workflow and acceptance criteria are requirements. Examples, suggested labels, numerical targets, and implementation techniques are identified as such. The source register records the earlier research; its repository snapshot is historical and must be checked against current code before implementation.

## Instruction to the implementing agent

Execute this contract against the current repository. First read its nearest AGENTS.md and relevant project rules, inspect the owning particle, preview, codec, CASC, and document-history paths, and record any change from the historical baseline below. Use one known-good project path before choosing a new mechanism. Refine visual details as needed while preserving the required workflow and native data. A genuinely unsupported format capability must be reported with a concrete source example and coverage impact; do not silently drop it or claim complete support. Implement through the repository's normal PR process and demonstrate the acceptance results. The user's current model data and working preview must survive the change.

## 1. Authority, baseline, and boundaries

The user's explicit requirements are authoritative: an existing visual editor must become less text-heavy; offer Classic and Clueless modes; support direct manipulation and sliders; retain immediate feedback; provide a separate particle playground; reopen model effects directly; and include a genuine Warcraft particle preset library plus personal presets. The library is organized by recognizable effect names and appearance, across source units, using recipes extracted from the user's CASC files. Unit-first browsing is explicitly rejected. Earlier requirements for live editing, slow motion, and fitting weapon sweeps remain in scope.

The inspected repository is `KlugerA/MDLxL`, `main` at commit `d492b5ccdb690197eb10371f0bde9155d3481086`, version **0.14.0**. The inspection covered source and styles, not an executed Windows application. No current GUI screenshots, performance measurements, full library inventory, or in-game tests were produced during this research. Astra must inspect the then-current main and record differences before implementing. [C1–C8]

Retain the existing renderer, codecs, model preservation, and document-history infrastructure wherever practical. Do not interpret this request as permission to redesign unrelated main-window sidebars, widen permanent panels, rewrite the renderer wholesale, or alter unrelated model data. Follow the repository's AGENTS.md. [C1]

**Priority:** responsive visual authoring, effect-first stock discovery, and trustworthy saved output are all mandatory. A renamed property form, texture-only gallery, hand-authored sample set, or source-unit browser does not satisfy the request. Keep the existing editor's working preview and immediate feedback where they already work; change the interaction and ownership boundaries that prevent the requested workflow.

## 2. What already exists—and what actually needs changing

`app/ParticleEditor.jsx` already supplies a dedicated PE2 modal, model animation playback, a scrubber, emitter selection, texture selection, color inputs, creation/deletion, and undoable edits. It starts playing by default. The editor is therefore not missing a visual preview. [C2]

Its interaction is still predominantly a technical property form. Seven sections open by default: Emitter, Animated parameters, Rendering, Segments, Head and tail animation, Flags, and Miscellaneous. `Fields.jsx` commits numerical fields on blur/Enter. Rotation and expanded track-editor focus pause playback. The CSS allocates 45% of the main body to preview, with the remainder primarily controls. These are source observations, not measured screen captures. [C2–C4]

`particlePreviewModel` clones the current model, retains the selected PE2, and removes other emitter families. Isolation hides geosets but does not create a reusable, independent effect asset. New currently means adding an emitter directly to the model document. [C2, C5]

The existing texture library enumerates image assets and explicitly does not open model data. It offers useful discovery, texture resolution, metadata, caching, and initial-page behavior, but not emitter-recipe extraction. [C6–C7]

The current preview owns a cloned model and its own WebGL context. The full hot-update lifecycle was not audited. Before wiring continuous sliders, inspect which changes can update an existing runtime and which currently trigger reconstruction. Do not assume the present commit-on-blur path can safely receive hundreds of updates per drag. [C8]

## 3. Research findings translated into requirements

These are original author explanations, developer changelogs, and individual community reports—not a representative survey or proof that every historical problem remains in current Warcraft builds.

**Visual explanations matter.** In the discussion accompanying Vinz's PE2 guide, readers specifically request examples and pictures because terminology alone remains unclear. The guide also distinguishes editor behavior from game behavior. Consequence: make controls demonstrate their effect, and keep game-validation requirements separate from editor-preview claims. [R1]

**Visible geometry can control emitter settings.** Fingolfin's Blender exporter uses a plane's dimensions to author an emission region. This is a useful precedent for interactive proxies, not evidence that emitted sprites are persistent editable mesh vertices. Consequence: map visible handles to native properties. [R2]

**A continuous weapon trail is not just a stretched sprite.** BlinkBoy explains ribbons as connected emitted edges associated with a material. Consequence: retain the distinction between PE2 streaks and ribbons, and inspect trails with their source motion. His illustrative pseudocode is not production code. [R3]

**Round-trip mistakes can destroy an otherwise convincing preview.** NeoDex's developer changelog describes fixes involving imported visibility controls, flags, rotation, tail UV fields, and ribbon material settings. Those are examples from another tool, not alleged MDLxL bugs. Consequence: switching UI modes and opening imported effects must never silently replace data with defaults. [R4]

**Reuse is a real workflow.** A Magos support discussion recommends starting from an existing in-game emitter. Consequence: source presets must contain authored behavior and dependencies, not merely a thumbnail of a texture. [R5]

**Successful refinement can mean removing effects.** The Frost Arrows changelog records reduced particle counts, corrected birth animations, and adjusted ribbon placement. A Pandaren Battleship review identifies an emitter remaining active during decay. Consequence: inspect sequence boundaries, compare multiple instances, and provide easy timing and amount controls—not a one-click “more spectacular” algorithm. [R6–R7]

**Modern precedents support a playground.** Unity documents resimulation of existing particles while authoring. Boris FX documents emitter and multi-emitter preset organization. W3C's supplemental cognitive-accessibility guidance favors familiar words over unexplained jargon. Borrow those interaction principles, not unsupported Unity/Niagara/Particle Illusion engine features. [R8–R10]

## 4. One workspace, two contexts, two modes

Use **Particle Editor** as the product name. Do not introduce several disconnected particle windows.

### 4.1 Context: Lab

Lab is a self-contained working space that opens without a model. Its Particle Library presents named effect thumbnails directly: choose an effect, experiment, then choose **Save preset** or **Add to model**. There is no preliminary unit selection, asset-path browser, or requirement to know which Warcraft model contains the effect. The user can also start from a personal preset or a new basic emitter; play, pause, manipulate, and save it.

A lab draft has its own undo history and dependencies. Opening or editing a preset creates a working copy. Browsing, scrubbing, changing colors, and experimentation must not dirty the open model or overwrite the preset.

A new emitter should be visibly useful immediately: provide an original, redistributable starter texture and sensible defaults, or an explicitly resolved local texture. Do not create an invisible emitter that requires entering a texture ID before anything appears. Starter effects must be labeled as MDLxL starters, never falsely presented as Blizzard originals.

Closing with an unsaved lab draft preserves it through the application's draft/recovery mechanism or offers a short save/discard decision. It must not disappear silently.

### 4.2 Context: On model

Double-clicking a visible particle/effect selects its owning emitter or effect group and opens this same workspace in On model context. The normal editor entry point and an effect-list selection are equally valid routes, including when the effect is currently invisible.

On model edits affect the selected existing effect through normal undoable document transactions. Closing the editor does not implicitly discard committed model edits. Saving to My presets creates an independent recipe rather than a live connection to every instance.

A **Solo** control hides other effects for inspection without changing their authored visibility. The normal context preview must also support seeing the complete model and all its effects together. The current selected-PE2-only filtering is not sufficient for that view. [C5]

Switching between Lab and On model must make ownership clear with a short context indicator. Do not silently detach an existing effect, discard a draft, or replace the selected model effect with the last library selection.

### 4.3 Mode: Classic

Use native names, numerical values, existing animation-track concepts, and precise controls. Preserve every currently supported PE2 setting. Standard terminology remains available for users following Hive tutorials.

Classic still benefits from the new library, working space, preview, undo, and transport. It is not a separate legacy renderer. It need not display every section expanded by default.

### 4.4 Mode: Clueless

Use the exact user-requested name **Clueless**. Default to it for users without a saved mode preference; remember the chosen mode. It is a visual interface, not a reduced-capability converter.

Expose recognizable controls, sliders, actual-texture samples, and draggable handles. Put technical names in optional tooltips or an on-demand detail view—not permanently after every friendly label.

Mode changes must not mutate the recipe, insert keys, reset flags, round values, normalize colors, flatten tracks, or clamp imported values. Both modes bind to the same canonical values and commands.

## 5. Layout and interaction budget

With the library closed, give the live stage at least two-thirds of the editor's usable body at the reference desktop layout. Use an expandable/resizable workspace within the existing application conventions; do not reserve a new permanent main-window sidebar.

The default Clueless controls are **Size, Amount, Spread, Speed, Lasts, and Rise/Fall**. Show at most six primary parameter controls at once. Context tools may replace these controls rather than stacking another panel underneath.

Keep a small top-level set of actions: Library, New, mode selection, context selection, and the appropriate Add to model or Save preset action. Use an unobtrusive transport strip. Open deeper tools such as Shape, Life, Texture, and Timing only when selected.

No explanatory paragraphs, raw ObjectIds, texture paths, interpolation names, key-count tables, or repetitive “changes apply immediately” text in the normal Clueless view. Use a brief message only when there is something actionable, such as a missing texture or unsupported ingredient.

Do not replace a text wall with an icon puzzle. Use familiar icons with short labels where needed, accessible names, visible focus, tooltips on demand, and keyboard equivalents. No required action may depend exclusively on hover, color discrimination, or double-clicking a small moving target. These are design requirements; do not make medical claims about ADHD. [R10]

Use the existing application theme and focus conventions. Modern means clear hierarchy, responsive interaction, and sufficient working space—not gratuitous glow, animation, or a second visual identity.

Library thumbnails are mostly still frames. Animate the selected tile, not dozens of tiles simultaneously. Stop hidden previews and release unused resources.

## 6. Native-field mapping and control semantics

The following is the proposed UI mapping. Native fields and their categories are grounded in the inspected application controls/schema and the MDX format references. Friendly labels and gestures are design decisions. [C2, C5, F1–F2]

| Classic field | Clueless label/control | Binding rule |
|---|---|---|
| EmissionRate | Amount | Slider for rate; becomes Burst amount under Squirt. |
| Squirt | Continuous / Burst | Two visible choices; retain the underlying emission track and use a tested burst-authoring command. |
| Speed | Speed | Slider or launch-arrow tool; do not rename it Reach. |
| Variation | Speed variety | Spread of initial speeds; never market this as turbulence. |
| Latitude | Spread | Angular handle with a matching direction-envelope guide. |
| Width / Length | Spawn area | Two axis-aware rectangle handles; precise values stay in Classic. |
| Gravity | Rise / Fall | Signed slider with a neutral center; preserve the selected engine's actual coordinate behavior. |
| LifeSpan | Lasts | Duration slider; distinct from the time when the emitter is enabled. |
| ParticleScaling | Size | Three life-stage samples; overall scale preserves their relative values. |
| SegmentColor | Color | Three actual-texture color samples. |
| Alpha | Opacity | Three life-stage opacity controls; not an emission switch. |
| Time | Changeover | Draggable middle marker on the particle-life strip. |
| Visibility | Emitting | On/off timing control; not the opacity of existing particles. |
| Head / Tail / Both | Sprites / Streaks / Both | Visual examples and correct native flags. |
| TailLength | Streak length | Slider and optional endpoint handle; account for velocity-dependent appearance. |
| TextureID | Picture | Thumbnail picker, including missing/replaceable texture states. |
| Rows / Columns | Picture grid | Grid over the actual texture. |
| Four UV animation triplets | Picture frames | Separate early/late sprite and streak ranges, plus repeat controls. |
| ModelSpace | Carry particles / Leave behind | A motion preview; separate from choosing which bone owns the emitter. |
| XYQuad | Flat / Face camera | Orientation example; advanced combinations retain their existing flags. |
| FilterMode | Blend look | Rendered comparison tiles, backed by the five native PE2 modes. |
| Unshaded / Unfogged | Keep brightness / Ignore fog | On-demand options, not default screen clutter. |
| PriorityPlane / SortPrimsFarZ | Draw order details | Advanced controls with actual renderer/game validation. |
| ReplaceableId | Team color or source-specific choice | Recognizable supported choices plus a precise Classic fallback. |

The native PE2 blend enum is not the material-layer enum. In the inspected schema the modes are Blend, Additive, Modulate, Modulate2x, and AlphaKey. Do not introduce a material-only option or duplicate AlphaKey as two independently stored settings. [F1]

Each binding must declare storage type, units, supported animation, legal authored domain, suggested slider domain, sampling rule, affected runtime state, undo scope, and export behavior. The suggested slider range is not a codec limit. Preserve valid imported values beyond that range; expand the range or provide precise access instead of rewriting the model.

Sliders must operate continuously without typing, with an appropriate linear or nonlinear mapping, a usable zero position where relevant, and keyboard adjustment. Exact numerical readouts can appear during deliberate inspection, but are not required for the primary workflow.

A control whose meaning changes with a mode must change its short label or example. A control that cannot visibly affect the current rendering combination must not give false feedback. Explain that limitation only when the user tries it; never silently change the blend mode to make a slider appear functional.

## 7. Direct manipulation: grabbing the picture

### 7.1 Minimum required direct controls

Clueless must include direct stage manipulation, not sliders alone. The minimum is particle-size handles, spawn-area handles, an aiming/orientation handle, and a spread handle. The life-stage tool must offer direct sample resizing. All gestures have slider or keyboard alternatives.

### 7.2 Selecting and pinning a particle

A visible sprite can be picked as a route to its owning emitter. Preserve an owner identifier through the render/picking path. A hit must account for visible geometry and useful transparency, rather than treating the entire transparent texture rectangle as solid. Overlapping effects need a small candidate chooser or cycle action. The list remains a fallback.

At pointer-down, pin a **representative particle sample** for the gesture. Capture its emitter, life-stage context, reference size, transform, and pointer mapping. The actual simulated particle may move or die; that must not steal selection or terminate the drag. Other particles and the model can continue playing.

Dragging corners changes a native size parameter. It does not create persistent vertices for that one emitted particle. Show which life sample is being edited—Young, Middle, or End—with a small selected-state cue.

### 7.3 Defined gestures

**Size:** a selected sample has uniform resize handles. In overall-size mode multiply all three authored size values by a common factor, preserving their shape. In life-stage mode change only the selected stage. A zero-size stage needs a selectable proxy; do not divide by zero or force it nonzero merely by opening the tool.

**Spawn area:** a rectangle describes where particles originate. Drag its two dimensions independently. Compute it from the actual emitter and parent transforms, not world axes inferred from the camera. Do not let the Magos MDL/MDX axis discrepancy become the implementation specification. [R1]

**Aim:** rotate the emitter's own orientation through an existing-style gizmo. Do not rotate the parent bone, sword, or whole model as a side effect. Choose placement adjustment versus animation-key edit explicitly.

**Spread:** drag the direction envelope. Do not implement every Latitude as `tan(angle)` on a narrow cone; broad or hemisphere-like distributions need a non-singular representation validated against the pinned renderer.

**Travel:** in an explicitly selected Speed or Rise/Fall tool, a representative trajectory can act as a bounded handle for that parameter. Do not silently change several unrelated fields to make an arbitrary dragged point fit.

**Streak length:** an endpoint handle is useful where the current speed makes the mapping meaningful. At zero or ambiguous velocity, use a stable example or the slider; do not generate infinite parameter values.

### 7.4 Safe behavior during animation

Latch the editing reference frame and pointer-to-parameter mapping at gesture start, or use an equivalently stable screen-space mapping. Animated movement under a stationary pointer must produce zero additional edits. Keep the visual helper attached to the evaluated emitter while separating that motion from user drag input.

Use pointer capture. Complete one undo transaction on release; Escape restores the pre-gesture value. Selection, camera, or sequence changes during a gesture must terminate or cancel it deterministically.

### 7.5 Native limits

PE2 stores emitter parameters and life-stage arrays, not arbitrary persistent polygon edits. Do not promise free corner warping, individual particle trajectories, arbitrary per-particle spin, or a spline-shaped emission mesh that the format cannot save. Such controls require a deliberately different representation, not invisible conversion. [F1–F2]

A texture silhouette belongs in texture editing. A continuous generated strip belongs in the ribbon workflow. This contract does not authorize automatic conversion of a particle effect into a geoset.

## 8. Life, texture, and appearance tools

Replace Segment 1/2/3 fieldsets in Clueless with a horizontal **Young → Middle → End** strip containing the actual particle picture at each stage. The middle marker edits Time. Each sample supports size manipulation, a color picker, and opacity adjustment.

These are the three native life-stage values—not an unlimited curve system. Their axis is a particle's age, not the model animation playhead. Preserve exact imported endpoints, including unusual Time values; handle overlapping markers safely without modifying the data on open. [F1]

Opacity zero must not make the selected control impossible to grab. Use an outline/checker indication only for the selected editing proxy; do not add an outline to the actual rendered effect or export.

The Picture tool shows the resolved texture with its rows/columns grid. Selection works on visible cells, not raw TextureID text. Early/late sprite and streak ranges remain separate. A grid-size edit must identify now-invalid frame ranges and request a bounded correction rather than silently wrapping or deleting them. Preserve all four arrays on round-trip.

Blend look uses rendered swatches against both light and dark backgrounds. These are comparisons of the same recipe under explicit mode choices. A source-colored image is not guaranteed to become any desired color through tint alone; preview the real texture and renderer, not a generic white stand-in. No automatic texture repainting.

For a multi-emitter recipe, show compact ingredient thumbnails only on demand. Solo and mute are preview states. The user can edit one ingredient or explicitly save the whole group. Never alter every emitter because their textures happen to match.

## 9. Playback, live animation editing, and sweep fitting

### 9.1 Default: linked slow motion

Provide Play/Pause, Step, a draggable playhead, Loop selection, and preview-speed choices such as 0.10×, 0.25×, 0.50×, and 1×. Slowing playback must not modify saved animation times or emitter fields.

In linked mode, model movement, animated emitter properties, particle simulation, sprite playback, and global-sequence phases advance consistently. Compare matching model times and global phases, not matching wall-clock times. This is the mode for judging whether a trail fits a weapon.

A model-animation label that says Frame must not cause a conversion from Warcraft's stored time units to arbitrary display-frame numbers. Preserve the existing model timebase; show precise times only in the appropriate detailed mode. [F2]

### 9.2 Optional exposure, required capability: unlinked inspection

Provide independently adjustable animation and FX playback rates behind the transport's secondary controls. Mark the unlinked state with a small persistent indicator. This is an inspection mode: different clocks alter the relationship between weapon movement, births, and particle aging. It must not be represented as the exact result Warcraft will play.

Define and test which clock evaluates node transforms, animation tracks, continuous birth accumulation, particle aging, sprite progression, and burst triggers. Pausing FX must not queue an unexpected burst that fires when the user resumes. A frozen particle snapshot may be used for inspection, but must be distinguishable from an advancing native simulation. Re-linking rebuilds a coherent state at the selected time.

Do not add a fictional exported PE2 TimeScale field. Do not silently bake independent preview speeds into Speed/Gravity/LifeSpan. A universal “slow this effect in game” command is outside this draft: moving parents, emission timing, tails, and sprite phases make it more than multiplying three numbers. [F1–F2]

### 9.3 Editing animated properties while playing

Static fields remain editable during playback. For an animated field, explicitly select **This key** or **Whole track** through a compact scope control. Default to a non-destructive, clearly indicated scope; do not convert an existing track to a static value just to attach a slider.

Latch the key time or selected track range at gesture start. Do not generate a new key on every rendering frame while the playhead moves. An explicit recording feature would be a different feature and is not requested.

Whole-track adjustments must state whether they offset or multiply existing values. Preserve keys outside the chosen scope, interpolation type, tangents, and global-sequence references. Never silently resample an entire animation. A command that needs a destructive conversion must request that conversion separately.

PE2 supports animated scalar properties and node transforms, but its LifeSpan and three life-stage color/size/alpha arrays are not arbitrary per-sequence tracks. The binding schema must only offer keyframe controls for fields the native representation supports. [C5, F1]

### 9.4 Sweep fit

Let the user select a short attack/spell interval and loop it slowly. Display the selected emitter's sampled path and a small number of ghost positions. Clicking or dragging a timing marker along that path selects a time on the existing path; it does not redraw the skeleton animation.

At a self-crossing path, use the current time neighborhood or a small time chooser to resolve the selection. An arbitrary nearest-point jump to a different part of the attack is unacceptable.

For PE2, expose emission window, particle size, lasting time, spread, and streak length. For ribbons, expose the two strip-edge offsets, lasting time, emission timing, and material appearance through the native representation. Preserve the current parent and animation unless the user explicitly edits them.

A ribbon's strip follows its emitted history. A frozen source can therefore be a poor test of a moving trail; offer source motion or an explicitly preview-only demonstration sweep in Lab. Do not export that demonstration path unintentionally. [R3]

### 9.5 Reproducible scrubbing

Use deterministic seeded simulation for authoring comparisons, without making the preview seed a fictional Warcraft property. Backward seeking must reconstruct state by replay/checkpoints, not integrate with negative delta time.

Snapshots must include birth accumulation, particle state, RNG state, relevant global phases, and the emitter's motion history. Changes to lifespan or motion may invalidate more history than changes to an appearance swatch. Keep a dependency-aware invalidation strategy.

Step over long frames without skipping narrow emission windows or Squirt keys. Merely reducing the average timestep is not proof that every event is visited; split at relevant event times where necessary. Add tests for exact boundaries and loop seams.

## 10. Immediate feedback, transactions, and performance

All continuous controls use a particle-specific gesture pipeline:

**Capture baseline → update working value on input → update/reconstruct affected preview state → render → commit one undo step on release.**

Do not wait for blur, Enter, an Apply button, or dialog closure to show slider/gizmo changes. Do not create an undo record for every pointermove. Escape restores the captured baseline in both data and preview.

Keep the GL context, camera, texture cache, selection, and playback position stable during ordinary parameter drags. Do not repeatedly remount GamePreview or parse/export/reimport the entire model to apply a scalar change. Structural changes may rebuild the necessary emitter resources, but not unrelated model state.

Implement one parameter/transaction adapter shared by Classic fields, Clueless sliders, direct handles, and animation tools. Keep shared `Fields.jsx` behavior intact for unrelated editors unless a separate audited change is necessary. Suggested new module names are implementation choices, not evidence those modules already exist.

Separate **natural playback** from **authoring resimulation**. In natural playback, use the renderer's native behavior for particles already alive. During authoring, a deterministic reconstruction can show the current recipe immediately. Unity provides a precedent for this distinction. [R8]

Do not clear and restart the selected emitter on every slider event. That produces flicker, disappearing tails, and effects that never get old enough to inspect. Coalesce reconstruction work, cancel stale jobs, and retain the last valid frame while expensive work completes. A renderer that continually displays stale settings without indicating an update is also unacceptable.

Audit the installed `war3-model` version before patching private controller state. Encapsulate any unavoidable private access in one tested adapter. Do not spread assumptions about internal arrays throughout UI components or upgrade dependencies just to avoid understanding the existing integration.

**Proposed acceptance targets:** on recorded reference hardware and a reproducible representative fixture, p95 input-to-visible-feedback must be at most 100 ms; target 60 fps playback, and do not regress a baseline fixture that runs at 30 fps or better. Measure before and after. These are engineering targets, not measured claims about the current editor or guarantees for unlimited effects.

Define that fixture before implementation: model, textures, emitter count, live particle count, viewport dimensions, sampling interval, and hardware. Also test an intentionally heavy effect. Do not silently cap exported values to make the performance test pass. Any preview-only budget reduction must be visible on demand and must never masquerade as the full effect.

## 11. Particle Library: effect-first browsing of extracted recipes

### 11.1 Required discovery experience and asset identity

**Open Particle Library → choose a well-named visual effect → experiment → save a preset or add to model.**

The default library is a gallery of particles/effects, not a gallery of units. Do not require the user to select a race, unit, source model, or original emitter name before seeing usable effects. A stock effect belongs beside visually related effects regardless of which unit supplied it. Source units and model paths belong in optional Details and secondary search aliases; they are not the top-level organization or default card titles.

A **picture/texture** is one image resource. An **emitter recipe** is native behavior plus its dependencies. An **effect group** may contain several emitters, ribbons, and other visual ingredients. These are different objects and must not be conflated. Native schemas distinguish these structures. [F1–F2]

Library entries must carry actual extracted recipes. Preview the particles/effect itself, not a source unit's icon or the texture alone. A manually invented recipe must not masquerade as the extracted original.

Provide three obvious collections: **Warcraft**, **My presets**, and **Favorites**. Within them, organize by a compact set of understandable appearance categories such as **Fire, Smoke, Sparks, Magic, Glows, Trails, and Bursts**, with All and Other available. These categories are proposed starting labels, not claims about the scanned corpus. Permit multiple tags where an effect fits several categories. Do not expose a technical taxonomy or another tall permanent filter panel.

The card's primary content is its effect thumbnail and a short useful name. Choosing a card loads a working copy into Lab and shows it playing; it does not add anything to the open model. Animate the selected preview, not the entire gallery. Keep details, file paths, source units, emitter IDs, and compatibility explanations out of normal cards unless a short actionable status is necessary.

### 11.2 Good names, meaningful search, and variants

Use plain names that describe the effect's visible appearance or motion. A suitable pattern is **[useful descriptor] + [visible effect]**, with a motion qualifier only when it helps distinguish variants. Illustrative names include **Small flame**, **Thick smoke**, **Flying embers**, **Blue sparkles**, **Purple glow**, **Burst of sparks**, and **Blade trail**. These are naming examples, not a verified list of extracted Warcraft effects.

Names must describe the actual rendered recipe; texture filenames and raw emitter names alone are not reliable descriptions. Do not invent a semantic identity just to fill the catalogue. Use extraction metadata and observed previews to generate and review naming suggestions. Ambiguous entries remain browsable under a neutral short label and thumbnail until named. Store naming confidence/review state internally rather than covering the default gallery in warnings.

Use familiar search terms, including combinations such as “blue sparks,” “slow smoke,” or “weapon trail.” Search display names, appearance/motion tags, and synonyms first. Original emitter names, unit associations, and asset paths remain secondary aliases for users who happen to know them. Friendly names remain the library's default in both Classic and Clueless; technical editor mode is not permission to turn the gallery into an archive browser.

Keep names stable across rescans. Allow a display-name/tag override without changing the native recipe or losing provenance. User overrides must survive extraction updates and must not be mistaken for changes to Blizzard's original emitter data. Genuine variants need meaningful visual/behavioral qualifiers, not a grid of dozens of identically titled cards or suffixes copied from node IDs.

Exactly duplicate recipes may share one gallery entry with all source associations retained. A shared texture, similar thumbnail, or matching particle color is not sufficient for deduplication: timing, fields, flags, dependencies, and required motion context may differ. Preserve genuine variants. Renaming or combining metadata must not rewrite native behavior.

### 11.3 Scope of “all classic WC3 particles”

For this library requirement, classic means the SD/classic asset set of the selected Warcraft installation/build, not the editor's Classic UI mode. Inventory emitter-bearing classic models across the configured CASC source, including units and the ability, missile, spell, portrait, building, alternate-form, and other effect models needed to represent their effects. Do not limit discovery to a manually selected unit roster or a `Units` folder. Follow external effect references during extraction. The exact count and boundaries come from the source inventory, not a hard-coded claim.

Unit/object associations are useful for provenance and coverage, but the gallery remains organized by effect appearance and friendly names. Unknown source associations must not hide otherwise usable recipes. Absence of a friendly label is not a reason to drop an extracted entry.

Resolve source variants correctly. Do not mix SD entries with HD or other asset namespaces merely because filenames match. Record source installation, build/version identity, logical path, physical source identity, and content hash. Missing or incomplete discovery must be reported as incomplete, not “all.”

### 11.4 Astra's local CASC extraction pipeline

Astra is responsible for implementing and running the bulk extraction/indexing workflow against the user's configured local CASC assets in the execution environment. This contract does not claim those files are mounted in this drafting session. Locate and reuse the existing configured game-data source first. Only request a source folder if none can be resolved; do not ask the user to identify each unit or manually export individual MDX, MDL, or texture files.

Reuse the existing game-data discovery, archive access, texture resolver, and thumbnail/cache patterns after validating their model-file capabilities. Add model enumeration and recipe extraction rather than relabeling the image-only texture catalogue. The current inspected project has related infrastructure, but this draft does not claim that its existing image-access code already enumerates or extracts model recipes. [C6–C7]

The pipeline is **resolve CASC source → enumerate classic model assets → parse emitter families and dependencies → preserve required motion/timing → identify exact duplicates and retain variants → generate previews → assign/review friendly names and categories → persist a searchable local library and coverage manifest**. Naming and presentation metadata must remain separate from the lossless extracted recipe.

Read game assets without modifying the installation. Run expensive enumeration and parsing away from the interaction/render path. Make scanning cancellable and resumable; return usable cached/initial entries before the complete index is ready. A corrupt or unsupported file must not stop the whole catalogue. Continue subsequent runs incrementally where the source identity permits it rather than rebuilding everything whenever the library opens.

The full extraction must retain emitter fields, animation, pivots, parent dependencies, texture/material references, source context, and dependencies required by external/model emitters. Source-derived grouping must be traceable. Do not declare a speculative grouping the exact original “complete effect” without evidence or user confirmation.

CASC is the required source for this user. Preserve already-supported alternative providers without making additional MPQ work a prerequisite for the CASC workflow. Local extraction and catalogue use must not depend on downloading a community preset pack or uploading the user's game assets to a service.

### 11.5 Motion and preview fidelity

Provide an isolated effect preview by default; offer the source-model context only through an explicit secondary action when useful. The user should not have to open the source unit to judge, choose, or edit a particle. Choose a known active source clip for thumbnails where possible. Never overwrite saved visibility/rate fields simply to force an otherwise inactive emitter to show in the library.

When the source effect needs parent motion, retain the required motion context or offer a labeled demonstration motion. An isolated preview that drops the parent animation and changes the effect is not a faithful source preview. Support this motion internally without turning the entry point back into a unit browser.

Library playback and the editor should share the same rendering adapter. Missing pictures, missing parent dependencies, unsupported ingredients, and incomplete previews have distinct states. Avoid generic green-check “supported” status for an entry whose essential ingredient was removed.

### 11.6 Coverage report

Generate a machine-readable coverage manifest for each indexed game build. Include total candidate model assets, successfully parsed assets, emitter counts by family, optional unit/model associations, fully previewable recipes, insertable recipes, duplicate mappings, missing dependencies, parse failures, and unsupported cases. Also record named/classified versus review-needed entries so the gallery's naming quality can be assessed separately from extraction completeness.

Deduplicating identical recipes is allowed only while retaining all source associations and recoverable original variants/context. A missing emitter does not become covered because another asset uses the same texture. Unit associations are audit metadata, not required user navigation.

“All classic particles” is not accepted from a screenshot of twenty presets. The coverage manifest and exceptions must substantiate it. Do not hard-code a supposedly universal catalogue count before scanning the actual CASC asset corpus. Distinguish extraction completeness, preview compatibility, insertion compatibility, and naming completeness rather than merging them into one misleading success number.

### 11.7 Emitter families and honest completion

Full PE2 authoring is mandatory. A bounded ribbon workflow for sweep fitting and recipe preservation is also required. Inventory PE1/model emitters and their external model dependencies rather than discarding them.

If the corpus contains classic ingredients the current renderer cannot preview, that is additional compatibility work required for full-library completion—not permission to hide those entries. PE1 may have a narrower editing surface initially, but an entry is not fully supported until its promised preview and insertion actually work.

An intermediate PE2-only delivery must call itself a subset and retain the full coverage report. It does not fulfill the final “all classic” goal. Popcorn/HD authoring is outside this classic-focused contract; identify such entries explicitly rather than treating their existence as corrupt input. If a specific classic ingredient cannot yet be previewed or inserted faithfully, keep its catalog identity and failure reason visible in the report and call the library incomplete. A stock-library completion claim requires inventory coverage and working preview/placement for the discovered classic corpus; exceptions must be named and cannot be hidden in an aggregate percentage.

### 11.8 Local assets and personal presets

The stock-library strategy is bulk local discovery/extraction from the user's configured CASC installation, followed by a persistent friendly catalogue. Do not silently bundle, upload, or redistribute game model/texture bytes with MDLxL. Package the tool, its own starter assets, and appropriate metadata; retain provenance for imported third-party resources. Any separate asset-distribution decision needs its own review.

No game installation must still allow original starter effects and personal presets. Show one concise action to connect Warcraft assets. Do not populate a fake stock library to conceal the absence of a source.

Saving to My presets creates a persistent, independent recipe or group with a friendly user-chosen name and optional categories/tags. Support rename, tags, favorite, duplicate, delete, import, and export through the existing file/asset conventions. Native recipes are read-only originals; editing them starts a copy. Display-name/tag overrides are metadata only. Updating a saved preset never silently changes its already-placed instances.

## 12. Recipe storage, placement, and preservation

### 12.1 Recipe schema

Use a versioned data format with stable recipe and ingredient IDs. Required content: friendly display name, categories, tags, search aliases, and persistent user naming overrides; source provenance and all duplicate-source associations; native emitter family and exact fields; typed-array representation; flags; tracks and tangents; texture/material references; required node hierarchy and pivots; global sequences; anchor definition; source/default clip information; dependency manifest; and compatibility state. Keep raw source names separate from friendly display names. Record naming/review state in metadata without altering native data.

Store native behavior separately from UI metadata, library tags, thumbnails, demonstration paths, and preview clocks. Never serialize helper geometry, pinned samples, GL buffers, or a diagnostic time scale into MDL/MDX.

Preserve binary defaults behind animated fields where the application's codec supports them. Do not reconstruct an imported recipe solely from currently displayed slider values. Library thumbnails and cached previews must be invalidated by relevant recipe, dependency, renderer, and source-build changes.

### 12.2 Add to model

The user selects Add to model, chooses a target, places an effect anchor visually, and confirms. Show a live ghost while placing. Cancel leaves the model unchanged. Confirm inserts one undoable operation containing the effect and all required dependencies.

Offer a bone/helper picker and surface/pivot snapping where applicable. Choosing a bone attaches the emitter's source; it is not the same setting as carrying already-emitted particles with that source. Keep those choices separate.

A copied recipe must remap ObjectIds, parents, PivotPoints, TextureIDs, MaterialIDs, texture animation references, global-sequence IDs, and other imported references correctly. Never assume source array indices remain valid in the target model.

Import only the necessary effect dependency graph. Do not silently transplant an entire unit skeleton or overwrite a target animation because that was easier than isolating the effect. Use an explicit anchor wrapper and preserve internal relative motion where appropriate.

For timing, default to an explicit source-clip/target-clip mapping rather than blindly copying absolute source timestamps. Offer fitting to a selected interval as a distinct operation, preserve key ordering, and never modify unrelated target sequences. Global loops remain global unless deliberately converted.

“Keep source motion” and “use target attachment motion” are different placement choices. Reparenting while preserving one pose is not proof that all animated poses remain unchanged. Test transformed and nonuniformly scaled parents; reject or explain unsupported transformations rather than inventing exact preservation.

### 12.3 Size versus whole-effect scale

The default Size control changes particle appearance, not necessarily the spatial extent of the entire system. A separately named Fit/Scale effect command may adjust multiple dimensions, but must define its field mapping and preserve the original recipe.

Do not claim that scaling a wrapper node always scales every native particle property uniformly. Validate any composite scale operation with the target renderer and game. A missing implementation is preferable to a silent mismatch between Lab and the saved model.

### 12.4 Asset resolution and safety

Deduplicate dependencies using source identity/content and relevant flags, not filename alone. Two different images called `Fire.blp` must not overwrite each other. Preserve native logical paths when those resources are resolved from the game.

Portable presets must not require another user's absolute filesystem paths. Mark unresolved custom dependencies, support relinking, and avoid falsely displaying the last cached image as the new missing texture.

Imported preset data is data, never executable code. Validate schema versions, counts, numeric values, file sizes, and dependency paths. Prevent directory traversal and archive path escape; enforce resource limits and cancellable work. Use atomic saves and recoverable previous versions for personal presets.

Unsupported fields or opaque model data must follow MDLxL's existing preservation rules. Never erase them simply because Clueless has no widget for them. Do not upgrade the output model version without an explicit, justified conversion.

## 13. Helping users make better effects without another tutorial wall

Provide a small set of original example recipes, with visible before/after comparisons available on demand. These are proposed starting points, not claims of universal best settings or exact Blizzard presets.

**Smoke:** compare a soft, expanding, fading particle with a constant-size abruptly disappearing version. Let the user adjust picture, opacity, lasting time, and rise without entering technical fields.

**Sparks:** compare short-lived distinct streaks with an overly dense cloud. Expose amount, speed variety, size, and lasting time. Preserve separation and readable motion instead of automatically maximizing density.

**Magic glow:** compare a restrained core/accent composition against indiscriminate brightness. Show the real result over light and dark surfaces. Changing a glow's color is not a substitute for a suitable source texture and blend choice.

**Impact burst:** show the burst at the selected impact moment and let the user move that moment on the animation timeline. Do not require learning the word Squirt before making a burst. Store tested native emission keys, including necessary boundary behavior, instead of a preview-only trigger.

**Weapon sweep:** compare PE2 streaks and a ribbon using the same motion so the user chooses deliberately. Offer slow looping and ghost positions, not a paragraph telling them what the trail should look like.

These examples are justified as teaching/authoring tasks by the observed demand for examples and by real effect revisions involving count, timing, and ribbon placement; the specific visual recipes here are design proposals. [R1, R6]

An optional Compare action must use the same seed, camera, clip, time, and global phase for before/after. A random reroll is not a fair comparison of a small edit.

Provide a compact test view for light/dark backgrounds, game-like viewing distance, two team colors where applicable, and repeated instances. Do not certify an effect as performant based on a single instance or its file size. For a constant-rate continuous emitter, rate multiplied by lifespan is a useful approximate steady-state live count; it is not a complete cost model or valid burst estimate.

Expose cost details only when requested or when an actual preview budget is reached. Keep optimization explicit. Never lower particle count, shorten lifespan, change opacity, or remove ingredients without the user's action.

Require tests of birth, idle, attack/spell, death, and decay where those sequences exist. This is not speculative polish: source-effect changelogs and reviews contain concrete timing and lifecycle corrections. [R6–R7]

## 14. Acceptance contract

Every requirement below needs an observable pass/fail result. A feature checklist without evidence is insufficient. Automated tests may use minimal synthetic fixtures; visual tests must include real source-derived effects with available assets.

| ID | Test | Passing result |
|---|---|---|
| A01 | Open Lab with no model loaded | A visible starter effect can be changed, saved, and reopened without typing numbers or creating a model document. |
| A02 | Browse and edit a Warcraft preset | The source preset and open model are unchanged until an explicit save-copy or placement action. |
| A03 | Change Classic → Clueless → Classic | Deep comparison of the canonical recipe shows no change, including flags, tracks, tangents, source values outside slider ranges, and all four UV arrays. |
| A04 | Inspect the default Clueless layout | At the reference desktop size the stage occupies at least two-thirds of the body, no more than six primary parameter controls are exposed, and there are no default technical-form paragraphs. |
| A05 | Drag a primary slider continuously | Visible feedback occurs during the drag; one gesture creates one undo step; Escape restores the baseline. |
| A06 | Grab and resize a moving particle | The pinned proxy remains selected even if the sampled particle dies; only the intended emitter's size field or chosen life stage changes. |
| A07 | Drag the spawn and spread handles | Saved values match the displayed guides; axes, broad angles, zero sizes, and parent transforms do not produce NaNs or mirrored surprises. |
| A08 | Keep the pointer still while a parent animates | No parameter changes arise from animation motion alone; editing never modifies the parent bone or model geometry. |
| A09 | Edit Young/Middle/End | Only supported native life-stage data changes; Time endpoints remain safe to display; invisible/zero-size stages remain selectable. |
| A10 | Edit an animated value while playback continues | The selected key time or track scope remains latched, with no frame-by-frame key spam and no conversion to static. |
| A11 | Linked slow motion | At matching model time, seed, and global phase, the effect agrees with normal-speed playback within a documented simulation tolerance. |
| A12 | Independent clocks and FX pause | An unlinked indicator is visible, resume does not release queued accidental bursts, re-link reconstructs coherent state, and preview settings do not change exported model data. |
| A13 | Scrub backward and loop a narrow effect window | Repeated visits reconstruct the same authoring state; burst events and narrow emission windows are not skipped by long display frames. |
| A14 | Fit a ribbon and PE2 effect to a weapon sweep | Source motion remains unchanged; the effect can be timed and adjusted in slow motion; demonstration motion is not exported. |
| A15 | Double-click a visible effect | The correct existing emitter/group opens for editing; it is not duplicated. Overlap selection and invisible-effect list access work. |
| A16 | Add to model, cancel, then confirm | Cancel changes nothing. Confirm remaps dependencies and creates one undoable insertion. Undo restores the prior model state. |
| A17 | Import recipes from two differently indexed models | ObjectIds, pivots, parents, texture/material references, global sequences, and timing are valid; no unrelated target data changes. |
| A18 | Save/reopen MDL and MDX | Supported PE2 values, flags, animation, all four UV triplets, and required dependencies survive; defaults do not overwrite imported data. |
| A19 | Open a layered/mixed recipe | Supported ingredients remain present. Unsupported ingredients are identified, never silently removed or counted as fully working. |
| A20 | Index the selected classic CASC corpus | A reproducible manifest accounts for candidate assets and discovered emitters, including relevant assets beyond unit models, with explicit failures/dependencies and duplicate-source mappings. Extraction, preview, insertion, and naming completeness are reported separately; the complete-library claim matches the report. |
| A21 | Save a personal preset, restart, edit a copy | Preset data survives restart; originals and previously placed instances remain unchanged; stale thumbnails are invalidated. |
| A22 | Missing installation, missing texture, changed build | The user receives a short actionable state; no fake stock entries, stale dependency substitution, or mixed SD/HD identity occurs. |
| A23 | Import malformed or excessive preset data | Validation fails safely without code execution, path escape, uncontrolled allocation, or document mutation. |
| A24 | Measure interaction and preview performance | Hardware and fixtures are recorded; latency targets and baseline frame-rate conditions in section 10 are measured, not guessed. |
| A25 | Read-only documents, keyboard, and close/recovery | No writes bypass read-only state; primary operations have non-hover alternatives; draft and model ownership remain clear through closing and recovery. |
| A26 | Test exported examples in Warcraft | Record exact game build, assets, test sequence, and observed result. Label anything not run as unverified; another previewer is not a substitute. |
| A27 | Find and open an effect without knowing a unit | The default library shows named effect thumbnails organized by appearance. A user can search/browse, choose an effect, and start experimenting without choosing a unit, race, model path, emitter ID, or texture. Both UI modes retain friendly library names. |
| A28 | Extract from the configured local CASC source | Astra demonstrates bulk extraction/indexing without manual per-model exports or source-asset uploads; source files remain unchanged. The cached catalogue opens after restart, scanning can be cancelled/resumed, and an individual bad asset does not block remaining entries. |
| A29 | Review names, variants, and rescan persistence | Names match observed previews; exact duplicates retain all source associations, visually similar but distinct recipes remain available, and user name/tag overrides survive rescanning. Source details remain secondary rather than becoming default card clutter. |

Include targeted native fixtures for Blend/Additive/Modulate/Modulate2x/AlphaKey; sprite/streak/both; animated gravity; burst emission; broad spread; replaceable textures; global-sequence tracks; moving and scaled parents; and intentionally unusual valid imported values. Some renderer differences may remain, but they must be isolated and reported with examples rather than hidden behind a generic claim of parity.

Run the repository's current compatibility and historical test suites and build commands, after checking the then-current package scripts. The inspected package exposes `pnpm test`, `pnpm run test:source`, and `pnpm run build`. This research did not execute them. [C1]

## 15. Implementation sequence and delivery

**Milestone 1 — audit and preserve.** Inspect current main and local rules. Record the actual particle, renderer, codec, CASC, and undo ownership paths. Capture before-state fixtures for imported data and existing preview behavior. Establish Lab/On model ownership, one canonical recipe binding, and the two UI modes without mutating data on mode switch.

**Milestone 2 — prove the complete vertical path.** Extract at least one real effect from the configured CASC source, show it by effect name in the library, edit a working copy in Lab, save and reopen a personal preset, place it on a model with remapped dependencies, and reopen that placed effect. This is a proof slice, not the final library claim.

**Milestone 3 — complete discovery and interaction.** Run bulk classic extraction and generate the coverage manifest. Finish the effect-first gallery, useful names, categories/search, duplicate/variant handling, persistent personal presets, and compatibility work needed for the inventoried classic corpus. Add pinned sprite, spawn/aim/spread, life-stage, and continuous slider tools; linked slow motion, marked unlinked inspection, reproducible scrubbing, and bounded ribbon sweep fitting. Demonstrate ordinary editing without numerical input.

**Milestone 4 — verify and hand off.** Provide source/target round-trip comparisons, default-view captures at normal and smaller sizes, measured interaction results, test/build output, actual local extraction results, and Warcraft game-test evidence where run. Screenshots must include a populated effect and the uncluttered default. Report each unrun or failing check explicitly.

These milestones are dependency and evidence gates, not permission to drop later requirements. Keep every partial result labeled as such. Do not stop after the proof slice or report the contract complete from a polished UI or an extraction pipeline that has never indexed the available CASC assets.

Code changes belong on an isolated `codex/` feature branch with a pushed PR into main. Follow the then-current AGENTS.md, build/versioning rules, and repository review gates. Stop at PR-ready unless the user authorizes merge. After an authorized merge, verify online main before reporting it shipped. Do not call a local edit, passing static test, or PR alone a shipped feature. [C1]

The execution report must distinguish implemented/tested, implemented/unverified, and not implemented. It must identify the exact source commit, resulting PR, game/library build, actual local CASC extraction run and coverage manifest, unresolved compatibility cases, and whether a complete stock library or only a labeled subset was delivered. A pipeline that exists in code but has not run on the available source assets is not the same as a populated library.

## 16. Explicit non-goals and forbidden shortcuts

No node-graph editor, new general-purpose particle engine, fluid simulation, collision physics, arbitrary force-field system, automatic texture repainting, or generic mesh sculpting is requested. Do not turn this into a Unity/Niagara clone.

Do not deliver a renamed numerical form as Clueless. Do not bury the stage beneath permanently expanded help text. Do not replace direct manipulation with sliders only. Do not recreate the whole renderer on every pointer event. Do not silently reset or simplify imported effects. Do not call textures “particles.” Do not replace the requested named-particle library with a unit/race browser, raw archive tree, or required manual emitter-export workflow. Do not claim the classic effect corpus is covered without inventory evidence. Do not treat independent preview clocks as a game-export feature.

**Definition of success:** the user opens a library of clearly named particle/effect thumbnails, chooses by appearance without needing to know a source unit, experiments immediately, grabs visible samples to reshape supported behavior, inspects the result in slow motion, saves a reusable preset or places it on a model, and later reopens it—without needing numerical input for ordinary work, and without losing the underlying Warcraft data.

## Source register

This source register is retained from draft 1, whose research was dated 30 September 2026. Drafts 1.1 and 1.2 incorporate the user's effect-first library and local CASC extraction clarification; neither adds a fresh source audit or claims extraction has already run. Historical forum dates describe the cited examples, not the current state of every tool. URLs are provided for the implementing agent to verify context. Cited source passages are summarized; the normative interface and acceptance decisions are this draft's proposals.

### Repository evidence

**C1 — Baseline, version, commands, and project rules.** Main was inspected at commit `d492b5ccdb690197eb10371f0bde9155d3481086`, published 30 September 2026; package and README identify 0.14.0. Follow the latest rules again at execution time.

`https://github.com/KlugerA/MDLxL/commit/d492b5ccdb690197eb10371f0bde9155d3481086`

`https://github.com/KlugerA/MDLxL/blob/d492b5ccdb690197eb10371f0bde9155d3481086/AGENTS.md`

`https://github.com/KlugerA/MDLxL/blob/d492b5ccdb690197eb10371f0bde9155d3481086/package.json`

`https://github.com/KlugerA/MDLxL/blob/d492b5ccdb690197eb10371f0bde9155d3481086/README.md`

**C2 — Existing particle editor, fully read.** Source for its modal, controls, direct document editing, playback, and undo calls.

`https://github.com/KlugerA/MDLxL/blob/d492b5ccdb690197eb10371f0bde9155d3481086/app/ParticleEditor.jsx`

**C3 — Shared fields, fully read.** Source for commit-on-blur numerical inputs and default-open sections.

`https://github.com/KlugerA/MDLxL/blob/d492b5ccdb690197eb10371f0bde9155d3481086/app/Fields.jsx`

**C4 — Particle editor styles, fully read.** Source for nominal 1120×740 dimensions and preview/control proportions.

`https://github.com/KlugerA/MDLxL/blob/d492b5ccdb690197eb10371f0bde9155d3481086/app/particle-editor.css`

**C5 — PE2 editing helpers, fully read.** Native parameter lists, rotation-key behavior, and current preview filtering.

`https://github.com/KlugerA/MDLxL/blob/d492b5ccdb690197eb10371f0bde9155d3481086/src/particle-editing.js`

**C6 — Texture library, fully read.** Image-only enumeration, source identity, annotations, and initial-page return.

`https://github.com/KlugerA/MDLxL/blob/d492b5ccdb690197eb10371f0bde9155d3481086/electron/texture-library.cjs`

**C7 — Main-process infrastructure, lines 1–110 inspected.** Game-data discovery, texture resolver, CASC/cache integration, and file/asset IPC patterns. Not a full audit of every provider.

`https://github.com/KlugerA/MDLxL/blob/d492b5ccdb690197eb10371f0bde9155d3481086/electron/main.cjs`

**C8 — GamePreview lifecycle, lines 155–270 inspected in this audit.** Owned model clone and WebGL setup. Full slider-hot-update and controller-lifecycle behavior remains an execution audit item.

`https://github.com/KlugerA/MDLxL/blob/d492b5ccdb690197eb10371f0bde9155d3481086/app/GamePreview.jsx`

### Format evidence

**F1 — war3-model's original TypeScript model schema.** Read current master, blob `2b5d1fcb0871a6499b3a774f2af5075f396a32d1`. Describes PE2, node, ribbon, PE1, and Popcorn data categories. This master read is not a substitute for verifying the application's installed 4.0.1 implementation.

`https://github.com/4eb0da/war3-model/blob/master/model.ts`

**F2 — Hive MDX Specifications.** Community-maintained primary reverse-engineering reference. Use alongside the application's actual compatibility codecs and target-game testing, not as infallible documentation of every version.

`https://www.hiveworkshop.com/threads/mdx-specifications.240487/`

### Research evidence

**R1 — Vinz, Particle Emitters 2.** Original guide 18 December 2020, main post edited 2 September 2021; accompanying discussion includes requests for examples and diagrams. Magos-centric observations must not automatically become assumptions about today's game or MDLxL.

`https://www.hiveworkshop.com/threads/particle-emitters-2.329335/`

**R2 — Fingolfin, MDL Exporter for Blender3D.** Original thread 26 August 2018. Visual plane-based authoring precedent for particle emission bounds.

`https://www.hiveworkshop.com/threads/mdl-exporter-for-blender3d.308138/`

**R3 — BlinkBoy, Ribbon Emitters from a mesh perspective.** 20 August 2013. Connected-edge explanation and material-based ribbon structure; illustrative code explicitly not production-tested.

`https://www.hiveworkshop.com/threads/ribbon-emitters-from-a-mesh-perspective.239816/`

**R4 — NeoDex 4.7 Reforged Edition.** Developer-maintained changelog. Concrete import/export UI and particle-field repairs; cited as regression-test precedent, not evidence of those same faults in MDLxL.

`https://www.hiveworkshop.com/threads/neodex-4-7-reforged-edition.354942/`

**R5 — Lot's o Question about magos (Mostly Effects).** December 2015 support discussion; includes a recommendation to begin from in-game emitters.

`https://www.hiveworkshop.com/threads/lots-o-question-about-magos-mostly-effects.273797/`

**R6 — Vinz, Frost Arrows.** Author's 2018–2019 changelog, including particle-count reductions, birth fixes, and ribbon placement changes. Supports iteration and lifecycle testing, not a universal numerical budget.

`https://www.hiveworkshop.com/threads/frost-arrows.309707/`

**R7 — Pandaren Battleship.** Resource review discussion includes an emitter continuing through decay; a concrete lifecycle-check example.

`https://www.hiveworkshop.com/threads/pandaren-battleship.303571/`

**R8 — Unity 6 Particle System reference.** Official authoring guidance including resimulation of existing particles when settings change. Used as a UX precedent, not as a WC3 feature list.

`https://docs.unity3d.com/6000.0/Documentation/Manual/class-ParticleSystem.html`

**R9 — Boris FX, BCC Particle Illusion manual.** Official library/preset and multi-emitter workflow documentation. Used as an organizational precedent only; its simulation modules are outside this contract.

`https://borisfx.com/documentation/continuum/bcc-particle-illusion/`

**R10 — W3C WAI, Use Clear Words.** Supplemental cognitive-accessibility design guidance. Supports familiar labels and avoiding unnecessary jargon; not a claim that this draft establishes WCAG conformance or treats ADHD.

`https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p01-clear-words/`