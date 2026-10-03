# OptimizeXL teaching agreement

The user supplies newly encountered defects, screenshots/video, damaged models and, when available, established repairs. These teach reusable detection and correction rules. The runtime optimizer must work from the model under review alone. A repaired counterpart is a test reference, never a required input or a source of copied animation data.

## Improvement without regression

- Add capability while preserving accepted behavior, especially the established flail optimization results. Do not morph an existing rule or loosen its tolerances merely to fit a new example.
- Do not hard-code fixture names, paths, texture names, bone names, geoset indices or frame numbers into detectors. Domain conventions may inform a rule, but a fixture's identity is not evidence.
- No duplicate or competing correction ownership. A new rule must not repair the same defect a second time, contradict an existing repair, or undo another approved correction. Existing accepted rules retain ownership unless the user explicitly approves a demonstrated replacement.
- Shared evidence is possible; overlapping corrective writes require resolution before delivery. Identify each rule's exact node/geoset, property, keys and sequence span. Disjoint edits to one track are complementary only when their combined behavior is proven. For example, an opening-key repair and removal of out-of-sequence keys can coexist because they modify different records.
- If two proposed corrections conflict, resolve their ownership, prerequisites or composition explicitly. Never rely on incidental execution order or silently apply both. Do not claim that a universal conflict resolver already exists: current validation and composition are implemented and tested per supported rule.
- Preserve the immutable accepted regression baseline. Never recapture golden hashes to hide drift. Additional, separately approved repairs may produce new outputs; verify them separately while keeping every old operation and result covered.

## Teaching cycle

1. Record the user's observed defect and intended result. Audit raw data, parser, native interpolation/visibility, renderer and save behavior as relevant; distinguish damaged data from a preview bug.
2. Compare the damaged example with a repaired reference when supplied. Identify the actual difference and the surrounding motion or visibility that must survive. Keep user files unchanged.
3. State the general evidence, counterexamples, supported domain and exact correction boundary. Compare against the existing rule inventory before writing a new detector. An ambiguous diagnosis can be a review flag; an automatic correction needs sufficient evidence for its target.
4. Implement the smallest addition in the existing stage and Before/After workflow. A correction should remove the evidenced defect completely within its scope while preserving intended motion, surrounding anchors, unrelated axes/channels and other animations. Do not erase valid movement to silence a warning.
5. Test the new positive case, ordinary/intentional counterexamples, previously repaired examples, stale evidence, and any interaction with existing rules. Verify single and selected-batch application, relevant approval orders, and that rescanning does not recreate the same defect or oscillate between repairs.
6. Compare serialized output and native playback/visibility where appropriate. Run the existing accepted-model regressions, then exercise the actual preview, approval, Back and save path affected by the change. Static success is not visual or Warcraft runtime acceptance.
7. Document the evidence, rule boundaries, tests and remaining limits in the verification log. Let the user inspect the proposed result. Carry future examples forward as regression cases; private model assets stay outside the repository unless explicitly authorized.

## Current rule boundaries

| Rule or operation | Evidence and correction boundary |
| --- | --- |
| Duplicate, animation and unused-data optimization | Preserve established reduction behavior and geoset exclusions. Adjustable reduction is a separate operation from defect repair. |
| Small-motion preservation during reduction | A whole-model tolerance must not erase a component's authored movement. After the established animation reducer, restore original spans that exceed 10% of that sequence's own component range or turning excursion (angular distance for quaternion rotation). Every previously retained key stays. This is preservation, not an irregularity diagnosis or repair; speech, recoil and machinery need no name-based exemptions. Zero/exact cleanup and separately approved repairs retain their ownership. |
| Missing local opening key | Hive's interpolated-channel finding. Add a constant lead-in matching native playback; adjust only the previously unused incoming cubic control. Preserve the outgoing curve, other keys and other animations. |
| Unused local keys | Nonzero keys outside every sequence, with active keys remaining in the track. Remove only those records; retain frame-zero setup keys and globals. Wholly unassigned tracks need a separate base-value decision. |
| Checker diagnostic coverage | Classify the actual checker findings independently of whether a proposal exists. Every finding needs a repair, owning-stage route or explicit unsupported explanation. An optimizer's empty removal list is never evidence that Hive has no unused notices. Test each known diagnostic family with generated examples against the bundled checker. |
| Redundant-key cleanup | One plan per track/domain removes Hive-similar interior keys only after checking the affected curve against its original. Other sequences cannot veto a supported local span. Re-evaluate neighbors, preserve boundary keys, validate combined/individual approval orders and rescan after approval. Do not change existing adjustable animation reduction to hide a diagnostic gap. |
| Remaining cubic redundancy | After supported key-level corrections on a track are exhausted, separately offer resampling of the local TRS spans around remaining Hive notices. Native interpolation supplies the samples; linear segments are encoded in the original cubic type. Preserve outer anchor values, exterior handles and every record outside those spans. Accept only below .001 component error at quarter-millisecond samples with no new value-redundancy notices in the affected domains. Global, overlapping, malformed and unsupported spans stay inspectable. This representation repair can increase size; it requires explicit preview/approval and never replaces the existing deletion owner. |
| Bounds, gravity and global-duration repairs | Use their existing supported Hive findings and previewable plans. Do not convert unrelated notices into these repair types. |
| Motion, snaps and contextual motion | Evaluate local curve evidence together with geometry influence and other animations. Repeating localized machinery or recoil is not automatically a defect. Flag suspicious body-wide patterns for inspection; correct only supported abnormal spans, preserving intended poses and surrounding motion. |
| Shared endpoints and death/decay continuity | Use supported pose agreement and transition evidence. Preserve animation interiors, Death's final pose where only its start is targeted, and independent global/effect motion. |
| Existing visibility irregularities | Keep established rare living-geoset, decay and dissipate rules intact. A new effect rule supplements these rather than replacing their logic. |
| Attached additive glow | Match used skin bones and overlapping geometry, require co-visibility in at least two animations, and establish that associated solid geometry is hidden throughout the suspect animation. Offer a correction only to the glow's visibility there. Global effect visibility and ambiguous overlapping intervals are outside automatic correction. This currently covers additive geosets, not every particle/ribbon association. |
| Sphere presets | Preset data is an explicit user choice, not a detector. Standard unit uses the two authored Footman spheres; Mounted rider retains the reviewed three-sphere arrangement. |

An empty Hive result means **zero errors, severe findings, warnings and unused notices**. Do not call a model fully checker-clean while unused notices remain. Supported fixes clear the demonstrated cases; new unsupported findings become future teaching cases rather than being hidden or reported as fixed.

### Approved correction to the historical animation baseline

The 06/07 teaching pair exposed four authored jaw keys removed by maximum animation reduction, not by an irregularity proposal. The same loss exists in the earlier accepted flail outputs. The user's instruction to upgrade authorizes preserving those motions instead of reproducing the destructive reduction. The original golden hashes remain unchanged. The regression reconstructs them by removing only newly retained, input-identical transform keys, using recorded pre-upgrade removed frames. All other records and previously retained keys must still match. This explicit exception does not authorize unrelated behavior changes or recapturing the baseline.

### Serializer reference verification

EditorDocument exports an atomically remapped snapshot when live ObjectIds differ from serialized type order. Optimizer round-trip checks must compare that same snapshot, including parents, matrix groups and pivots; live IDs and undo state remain stable. The historical Flail03 mounted-sphere output predates that serializer correction. Its golden hash stays unchanged. An optional historical reference must reproduce that exact hash before the regression accepts a current output differing only by the verified node-ID permutation. All other records remain subject to field comparison; missing parents, wrong groups and changed pivots are still rejected.

## Permanent review and delivery contracts

- Before and its size stay pinned to the original entry model. After contains approved changes plus the current proposal.
- Findings remain reviewable and skippable; selected fixes can be previewed together. Only approved changes are saved.
- Optimize New Copy writes the existing Before/After pair without overwriting the input. Nuclear does not introduce a third copy.
- Collision overlays remain confined to Sphereomancer. Preserve the compact editor, synchronized camera/playback and existing controls.
- Deliver on the feature branch with the attached PR. Push when asked; merge only with explicit authorization. The current teaching pass is left unmerged for the user's later merge with Showcase.

Implementation and evidence: [OptimizeXL](OPTIMIZEXL.md), [verification log](OPTIMIZEXL_VERIFICATION.md), and `test/fixtures/optimizexl-flail-baseline.json`.
