# Motion Inspector

Open **Movement**, choose a named animation in **Current Sequence**, then use
**Motion Inspector** at the top of the right sidebar. Its expanded view widens
only that sidebar; collapsing it restores the usual compact Movement layout.

## Inspect and edit

- **Find Motion Irregularities** scans the animation, or the selected node(s)
  and their parent chains. Playback and editing remain available during a scan.
- Amber timeline diamonds and the compact results list select the affected node,
  channel and time. Previous/Next warning navigates the visible results.
- **Show Keys** scrolls to the keys. The relevant interval and its keys are
  highlighted together, separately from ordinary key highlighting.
- Clicking an ordinary timeline key snaps to its stored time and selects its
  transform track. At coincident times, the selected node/channel takes priority;
  the channel picker and key list provide precise disambiguation.
- The inspector shows the animation, node, milliseconds, channel, interpolation,
  neighboring keys and absolute local values. Rotations use XYZ Euler degrees,
  the same XYZ convention as the existing rotation tools.
- A stored key is explicitly labelled **edits update this key**. An interpolated,
  held or default pose explicitly says an edit creates a key. Numeric fields
  commit on Enter or blur. Existing cubic handles are retained.
- Select Position, Rotation or Scale and use the existing viewport tools. The
  inspector follows the live drag preview; release commits through the existing
  document undo path. Escape cancels the gesture. Numeric edits refresh the pose.
- **Delete this key** is a deliberate, undoable edit to just that channel/key.
  No scan or hint deletes or cleans up animation data.
- **Replay section** and the focused scrubber inspect the surrounding interval.
  **Full animation**, or seeking outside that interval, removes the playback
  restriction. The authored sequence interval still controls interpolation.

## Diagnostics implemented

All timing is milliseconds. Distances use normalized quaternion angles, never
raw quaternion component differences. Local samples use `sampleTrack`; inherited
motion uses `sampleNodeMatrices`, including the existing inheritance flags.

| Hint | Evidence |
| --- | --- |
| Holding keys | At least two intermediate nearly identical poses, a hold at least three times longer than the final transition, and a significant evaluated change. Reports all holding times, final interval, angle/distance and average speed. Cubic segments that leave the pose do not count as holds. |
| Abrupt change | Significant change in at most 150 ms with sampled speed at least four times the neighboring baseline. |
| Pose spike | A significant excursion and return near the earlier pose within 350 ms. |
| Speed change | Significant movement and at least a fivefold sampled speed increase. |
| Stepped interpolation | Significant discrete change on a Step track; explains the held value and switch time. |
| Curve overshoot | Hermite/Bezier samples leave the endpoint range or rotation arc. |
| Model-space change | Sharp travel of a node pivot or orientation after applying the parent hierarchy. Clean child tracks are not labelled defective. Overlapping ancestor hints are presented as inspection clues, never proof of a particular causal key. |

Heuristics use five samples per key interval, a 15-degree local rotation threshold,
and translation thresholds relative to model size. They are inspection hints;
intentional impacts, holds, dense animation and attacks remain valid.

## Desired persistence

Desired decisions use the editor's existing private `localStorage` facility under
`mdlxl-motion-v1:*`, within the Electron profile (or browser origin). Nothing is
written into a model, document history, model metadata or export serializer.

Model identity combines SHA-256 of the opened source bytes with its full source
location (browser imports use name plus bytes). A successful MDLxL save registers
the new content/location as an alias of that editor identity. Replacing a file at
the same location with different, unregistered contents cannot inherit decisions.

Each decision has a SHA-256 signature of the diagnostic kind, animation name/interval,
node/channel, highlighted interval and contributing motion data. Bracketing keys,
interpolation, tangents, pivots, hierarchy and inherited transforms are included
where relevant. Quaternion signs and normalization are canonicalized. Unrelated
objects, material changes and keys in other local animations do not reset a
decision. Relevant changes produce a new signature and may warn again; undoing
them restores the original signature. **Show Desired** exposes matching decisions
and **Restore warning** removes them. A changed document requires an explicit
rescan; stale results cannot be marked Desired.

## Boundaries

- Local Rotation and Translation are classified. Scale is editable and contributes
  to hierarchy evaluation, but does not have a separate local diagnostic.
- Shared global transforms contribute to model-space sampling. Their own local
  patterns are not classified; Motion Inspector's fields and viewport posing
  are inspection-only for shared channels. Existing global timeline tools remain.
- Model-space inspection measures pivots and orientations, not every skinned
  vertex. Camera-facing billboard rotation, physics, attachments in a game scene,
  and animation loop seams are not diagnosed.
- Sampling can miss narrow curve extrema. There is no automatic attribution to a
  single parent key, curve fitting, baking, or automatic repair.
- Results are capped at 500 hints and 24,000 hierarchy evaluations. Short global
  loops have a 4,000-cycle cap. Limits are reported; selected-bone scans reduce
  scope. The real evaluator runs in a cancellable worker; no mesh data is sent.
- Decisions belong to this editor profile. External file rewrites or moves that
  MDLxL did not save conservatively receive a new model identity. Clearing the
  profile/browser storage removes decisions. They are not portable model data.

## Verification

New unit/component/worker tests cover holding keys, inherited sword motion,
smooth dense motion and equivalent rotations, timing boundaries, spikes, speed,
steps, overshoot, scoped transforms, undo/redo, Desired identity and invalidation,
and byte-identical unchanged MDL/MDX exports after read-only inspection actions.

`test/motion-inspector.electron.cjs` runs the rebuilt application using a synthetic
model and a separate profile in `out/motion-inspector`. It checks real timeline
and finding clicks, scans during playback, Desired/restore, focused replay,
numeric rotation, live viewport dragging, undo/redo, save/reopen and persistent
Desired decisions. Screenshots and metrics are written beside the fixture.
The observed drag changed the inspected key from 30 to 70 degrees and preserved
the mesh and seven-key track. Screenshots were inspected for layout and pose.

The final focused regression run passed 125 tests, covering Movement, classic
timeline, history, sequence boundaries, preview playback and all compatibility
tests. The final rebuilt Electron run also passed; the small fixture scan took
26 ms while the UI timer advanced three times and playback remained active.
The dense worker fixture evaluated 40,000 local intervals and 4,000 hierarchy
samples in about 0.6 seconds while the caller continued ticking.
Additional legacy-suite attempts were not wholly green: the existing
`Animations exposes inline RGB fields on All line` test expects 179 but the
current component reports mixed/blank values; the complete older
`keyframe-timeline.test.js` stalled in its codec cases. Its 13 isolated timeline
editing cases pass. Those test files and their source owners are unchanged from
the main-branch base. No claim is made that the entire historical suite passes.
