# Motion warnings

The normal Movement and Animations layouts are unchanged. Choose a named animation: a background
worker checks its motion and adds a small amber mark beneath an affected timeline
diamond. There is no permanent inspector, warning list, scan button, or wider
sidebar. Ordinary key selection does not open additional UI.

Click a warning in either timeline to hand selection to **Movement**, with the
affected bone and transform controller active. For holding patterns, the repeated
old-pose keys are selected in blue. The intended changed pose and outer end poses
stay unselected. Selection uses exact track/key identities, not a continuous
range that could accidentally include the intended pose between the holds.

The compact popup explains the limiting timing and offers **Select holding keys**
to return to the existing editor, plus **Replay section** and **Mark Desired**.
There is no duplicate Delete button: the existing Delete command and undo/redo
operate on the selection. Selecting another bone, channel, or time clears it;
copy and clear also respect the selected key identities. Selection changes no
model data, and normal Movement tools continue to own visual/numerical edits.

There is no expanded key list, numeric inspector, parent tree, or second scrubber
in the popup. The existing Movement controls remain available. Selecting another
ordinary key dismisses the old warning. Previous/next arrows appear only when
there are multiple warnings; coincident findings share one timeline marker.
Measured evidence is retained in the explanation's tooltip. Inherited motion and
curve overshoot do not invent a set of responsible holding keys.
Nothing is automatically deleted, repaired, or baked.

After a warning is opened (or this animation has Desired decisions), the timeline
context menu provides **Find Motion Irregularities** for an explicit rescan,
**Inspect selected bone and parents**, and **Show Desired**. The menu is otherwise
unchanged. These controls are absent from the normal view. Scans also refresh after edits,
without opening a popup or stopping playback. Closing details clears focused
playback. Scanning, navigating, and Desired decisions do not dirty the document
or add undo entries.

## Conservative diagnostics

Evaluation reuses `sampleTrack` and `sampleNodeMatrices`, including inheritance
flags. Timing is milliseconds, never assumed frame numbers. Rotation differences
are normalized quaternion angles, including equivalent quaternion signs.

- **Holding keys:** at least two intermediate repeated poses hold for at least
  400 ms and six times the final transition duration. The final transition must
  take at most 80 ms and change by at least 60 degrees (or 20% of model radius in
  translation). The warning explains that holding keys can compress movement;
  interpolation still operates. Identical keys are never automatically removed.
- **Abrupt changes:** at least 90 degrees or 25% of model radius within 50 ms,
  at least eight times the neighboring movement speed.
- **Isolated pose spikes:** a large excursion and return within 100 ms; or a
  single different key bracketed by demonstrably stationary intervals on both
  sides, returning within 300 ms. This strong structural pattern uses a smaller
  threshold (6 degrees or 4% of radius), with a 0.25-degree hold tolerance.
  The surrounding hold keys are included in the decision fingerprint.
- **Stepped tracks:** a significant switch of at least 60 degrees or 20% of radius.
- **Curve excursions:** an overshoot of at least that magnitude within 100 ms.
  Broad curved movement is not flagged merely for leaving the endpoint range.
- **Inherited motion:** model-space pivot/orientation jumps use the severe
  abrupt-change thresholds. A clean child is not blamed for parent movement;
  overlapping parent warnings are inspection clues, never proof of one culprit.

Speed changes alone are not warnings. Walking, starts/stops, ordinary attacks,
small deviations, and dense sampling are not defects. These remain conservative
inspection hints; deliberate snaps and holds can be marked Desired.

A read-only scan of the supplied Desktop `WH_WOC_KnightSlaanesh04.mdx` returns one
warning in **Channel**, around the pose at **245377 ms**, on **Bone_Arm1_L**.
The old pose holds until 245224 ms and returns at 245472 ms. The marker selects
Rotation keys at **245224, 245472, 245690, 245853, and 245997 ms**, preserving the
user's intended **245377 ms** pose and the 245000/246200 ms end poses. Its other
13 animations return no warnings. No model or animation names are special-cased.

## Desired persistence

Decisions are private editor `localStorage` entries under `mdlxl-motion-v1:*`.
Nothing is added to model nodes, tracks, keys, metadata, undo history, or export
serializers. Identity combines SHA-256 of opened bytes with the source location;
successful explicit saves register the new content/location as an alias.
Another model or an external replacement cannot inherit decisions by name.

Each signature includes the animation, node/channel, interval, and contributing
keys, interpolation, curve controls, pivots, and hierarchy. Relevant changes
can warn again; unrelated edits preserve the decision. **Show Desired** reveals
suppressed markers and clicking one offers **Restore warning**. Decisions remain
specific to this editor profile and are not portable model data.

## Boundaries and verification

Local Rotation and Translation are classified. Scale contributes to hierarchy
evaluation but has no separate local diagnostic. Global tracks contribute to
model-space samples; their local patterns and editing remain in the existing
global timeline. Inspection measures pivots/orientations, not every skinned
vertex; camera-facing rotations, game physics, and loop seams are not diagnosed.

The worker samples five points per key interval, capped at 500 findings and 24,000
hierarchy evaluations; very short global loops have a 4,000-cycle cap. Sampling
can miss narrow extrema, and conservative thresholds can miss less severe issues.

Focused tests cover severe jumps, the isolated held-track blip, ordinary fast
motion, repeated holds, inherited sword movement, equivalent rotations, sparse
edits, undo/redo, Desired invalidation, and identical unchanged MDL/MDX exports.
The Electron test uses a synthetic model in a separate profile and checks the
markers-only default, original sidebar width, no layout change on opening details,
selection from Animations into the correct Movement bone/Rotation controller,
noncontiguous holding-key selection, Desired/restore, replay, undo/redo, and
save/reopen. Ordinary Delete removes only the selected holding keys, preserving
the intended pose and all other channels. It does not alter the user's model
or testing window.

The focused regression run passed 135 tests. The rebuilt Electron synthetic
workflow passed, including the existing 300-pixel Animations and 164-pixel
Movement sidebars, a compact popup, scoped holding-key deletion, undo/redo,
and repeated popup dismissal.
A separate read-only Electron check confirms the one Channel marker and zero
markers in the other 13 Knight04 animations. An in-memory copy verifies that
removing the five surrounding holding keys preserves the 245377 ms key exactly
and lets the real evaluator move during the previously held interval (2.12
degrees by 245100 ms). Undo restores identical MDX output. The Desktop model is
never written. Screenshots of the normal Animations view and the selected
holding keys in Movement were inspected. This is not user acceptance of playback.

Broader legacy checks also encountered two failures in unchanged source/tests:
inline RGB on All line expects 179 rather than the current mixed value, and a
rest-pose export fixture fails equivalence on LevelOfDetail and AmbColor fields.
Those are outside this change; this is not a claim that the whole suite passes.
