# Resource Managers XL

The Material, Texture, Node and Geoset managers now put recognition, relationships
and visual visibility editing ahead of format fields. They remain dismissible
windows. The main editor's sidebars and existing document/serialization boundary
are retained. Exact native fields remain under **Advanced properties**.

## Edit while watching the animation

Animations now has a compact **Nodes** section directly below **Geosets**. Pick a
node in that list or in the model viewport, then edit its visibility without
opening another window. The main viewport keeps the animation pose visible;
the existing bottom timeline supplies the current key, a dragged range, a whole
animation, or Ctrl-selected separate keys. **Show** and **Hide** apply to that
scope. For bones/helpers the controls target their actually bound geosets,
without inventing a bone visibility channel. Changing geoset selection returns
the timeline to its geoset/RGB scope.

**Clueless** is the default in the managers and compact node controls. It puts
plain controls, the current target and the editing scope first. **Classic**
exposes native properties. Particle nodes have a **Preview particles** switch
connected to the existing display setting, plus a direct EMTR link. Playback
previews emission; already emitted particles still finish their lifetime.

Global tracks identify their clock and offer **Use this clock**. They are never
silently converted to local tracks. Nodes without native visibility or a bound
mesh explain that limitation.

All resource-manager windows, EMTR and the shared app dialogs can be dragged by
their title bars. The node list defaults to a flat list with wrapped names;
optional hierarchy indentation is bounded. The compact geoset picker uses
searchable rows with mesh names/numbers and texture names instead of four dense
columns of numbers. The existing sidebar width stays unchanged.

**Preview isolated mesh** draws and frames exactly one geoset. Shared materials
offer a mesh chooser. Explicit resource isolation survives the clean-preview
presentation boundary; ordinary clean previews retain their existing behavior.
The test verifies actual mesh index buffers drawn by WebGL, not only input props.

## Community evidence

Research read on 3 October 2026. These are firsthand tutorials and discussions,
not a claim that every modder uses the same tools or that forum advice establishes
engine behavior. Implementation follows MDLxL's codecs, sampler and save checks.

| Evidence | Repeated difficulty | Design response |
| --- | --- | --- |
| [Hive: Removing geosets/glow](https://www.hiveworkshop.com/threads/removing-geosets-glow.8928/) (2003-era thread) | Users manually trace numbered textures through material layers into geometry, with reference-renumbering hazards. | Name textures, show actual users, link directly between resources, retain the existing guarded deletion/remapping operations. |
| [XGM: MDL file structure](https://xgm.guru/p/wc3/mdl-structure) | Texture, material, geometry and visibility are separate records whose numeric references require format knowledge. | Explain the role of the selected resource beside its controls; keep native detail available without making it the first screen. |
| [Hive: Hiding geosets in particular animations](https://www.hiveworkshop.com/threads/how-to-make-a-geoset-disappear-when-specific-animations-are-played.256029/) (2014) | Editing visibility in Magos means looking up sequence frame numbers elsewhere. | Choose the animation by name, select its whole range and click Show or Hide. |
| [Hive: Fixing a ribbon effect](https://www.hiveworkshop.com/threads/how-to-fix-ribbon-effect.313567/) (2019) | A ribbon remaining visible requires finding the right node, a sequence start and an interpolation setting. | Carry node selection into the manager; show the track and its actual clock; new on/off tracks use stepped keys. |
| [Hive: Black transparency](https://www.hiveworkshop.com/threads/fixed-model-editor-black-transparency.313714/) (2019) | Texture alpha and material filtering are easily confused. | Show the texture, layer and appearance mode together; explain cutout, smooth transparency and glow beside the dropdown. |
| [Hive: Particle Emitters 2](https://www.hiveworkshop.com/threads/particle-emitters-2.329335/) (2021) | Emission visibility is a switch; it is different from opacity and emission rate. Old editors also misrepresent some native flags. | Node visibility uses On/Off, while geoset and material alpha use percentages. Existing native fields and interpolation are retained. |
| [XGM: Hiding an object in animations](https://xgm.guru/p/wc3/Spryatat-v-animatsii-obekt-zL8) (2023) | Modders must isolate the appropriate geoset and manually author both animation endpoints. | Follow actual bone bindings into geosets. Whole-animation actions author both endpoints automatically. |
| [Hive: War3 Model Tuner](https://www.hiveworkshop.com/threads/war3-model-tuner-v1-5.357550/) (2024–2026) | Users still describe copying visibility data between tools just to obtain a sequence list. | Named sequence selection and several-animation editing live beside the track. |

The resulting inference is practical: remove lookup work and expose consequences
at the edit site. Changing a shared material should show its users; selecting a
bone should lead to its geometry, not fabricate a bone visibility property.

## Workflows

- **Visibility:** choose an animation; click **Whole animation**, click a frame,
  or drag a time range; use **Show**, **Hide**, or a percentage for alpha.
  Click a key diamond or Ctrl-click/Ctrl-drag several keys to edit only those
  existing keys. **Several animations…** selects multiple named sequences and
  changes them in one history operation. A global track stays on its own clock.
- **Nodes:** Movement and Bones offer **Edit selected node…**. The manager opens
  the current selection and follows node picking in the main viewport, including
  Vertices. Selected vertices expose their actual influencing bones. Bones and
  helpers link to affected geosets; effect nodes link to EMTR.
- **Materials:** see texture-layer composition, users and individual layer
  controls. Appearance modes explain what they do. Texture links and an optional
  model preview make the target visible before editing native properties.
- **Textures:** see a decoded image or a clear unloaded state, its Warcraft path,
  named team-color/team-glow source, wrap controls and actual material/emitter
  references, including animated and modern texture slots.
- **Geosets:** see mesh counts, material and bone relationships. Edit visibility
  directly, creating its native geoset-animation record through the existing API
  when required. Geometry operations remain available in Advanced properties.
- **Undo/redo:** manager buttons, keyboard and desktop Edit menu use the existing
  shared history. Source files are only written by the normal Save workflow.

## Preservation and verification

Visibility range edits are inclusive milliseconds, the native Warcraft time unit.
They restore the previous curve immediately outside the selected range, using
one-ms transition boundaries. Existing interpolation is retained. Cubic boundary
insertion subdivides the curve, including its control values, to preserve its
shape outside the range. Keys and tangents in other sequences remain unchanged.
Converting a static value to a local track seeds the other animations with that
value. No global/local conversion is performed automatically.

The focused tests cover static and sparse tracks, every interpolation type,
global endpoint keys, separate key selection, reference relationships, undo/redo,
and MDL/MDX round trips. The Electron test exercises the rebuilt `dist` with a
disposable model and profile, real controls/pointer interactions, model preview,
and actual Save As files. It also checks that its source fixture remains unchanged.
The 56-test compatibility suite passes. The pre-existing animation text-parser
test expects negative times to throw, contrary to the current signed-time API;
neither that parser nor its test is changed by this work.

The revision's 38 focused visibility/preview tests pass. The broader existing
keyframe suite has three additional issues reproduced on the unchanged base
`1273cf38`: the Popcorn family round-trip test hangs, the Popcorn rotation fixture
fails save verification for emission rate/speed, and the Popcorn RGB text test
expects rounded decimals rather than the emitted Float32 values. These codec/test
issues are outside this manager revision; the full source suite is not green.

Warcraft runtime acceptance and user acceptance are separate from these checks.
This work does not publish a release, merge the PR or replace an offline install.

The second workflow check covers the compact Animations controls, actual viewport
node picking, global-clock handoff, dragged time ranges, Ctrl-selected keys,
manager/EMTR dragging, and actual isolated mesh draws. It also runs on the supplied
BattleStandardSkeleton and graveguard models, checks readable names and hierarchy,
and verifies both original files remain byte-identical. Generated changes are
only in disposable sessions; acceptance still belongs to the user.
