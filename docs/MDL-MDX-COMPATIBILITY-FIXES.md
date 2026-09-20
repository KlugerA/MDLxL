# MDL/MDX preservation fixes

Branch: `codex/mdl-mdx-roundtrip-fixes`

Date: 2026-09-20

The existing EditorDocument, model collections, history, chunk surgery, and disk-save path remain in place. `war3-model` is still the underlying dependency and has not been modified. Four local boundary modules repair its unsupported representations, retain untouched records, and verify the values that reach the saved file. WhiteoutLib is a reference only, not a dependency.

## Implemented

| Audit findings | Result |
| --- | --- |
| 1: v1100 texture slots | Read explicit slot IDs, retain sparse/reordered slots and static bases, write correct IDs for animated slots and integer tangents. Ambiguous duplicate/unknown slots make a source read-only. |
| 2: weak save verification | Compare actual fields, arrays, tracks, tangents, flags, paths, bindings and pivots after reopening. Integer values compare exactly; floats compare at file-format float32 precision. Abort serialization if an authored value would be lost. Version conversion uses this check too. |
| 3: MODL/SEQS metadata | Separate the 80-byte model name and 260-byte animation filename. Preserve sequence sync points and raw flag bits; only bit 0 controls NonLooping. |
| 4: GEOA colors | Consistent editor RGB at the MDX BGR boundary for static colors, keys, tangents, and retained static bases. Preserve explicitly enabled white tints in MDL. |
| 5: signed times | Signed event arrays and signed 32-bit keyframe validation/editing, including the text key editor. Large integer times are not rounded through float32. |
| 6: geosets | Preserve triangle primitive-group boundaries and raw selection bits. Update primitive counts when topology changes. Other primitive types remain read-only. |
| 7: modern skinning | Read/write the v1400+ uint16 SKIN stream; retain it through bindings, import, forge, bits-and-parts and existing vertex/UV operations. Weights retain their 0–255 range. |
| 8–10: Classic structures | Ribbon RGB splines, Plane/Cylinder collision volumes, float light attenuation keys and tangents. |
| 11: paths | Preserve all 260 bytes for texture, attachment and classic emitter paths. Enforce the actual 80-byte model-name field. |
| 12–13: modern records | Camera packed size/variant, variant 1/2 opaque bytes, visibility and depth-of-field tracks; v1200/v1300/v1600 light fields and tracks. Pre-1600 falloff defaults are retained without emitting modern fields into Classic MDL. |
| 14: opaque data | Conversion cannot bypass the opaque-data restriction. DILG/Glider is represented and its geoset references follow deletion. SNDS is retained opaquely; SNEM sources are read-only because their node references are not modeled. |
| 15–19: dialects and flags | Engine shader names and slot designators, named Hive slots, SortPrimitives, SelectionFlags, LevelOfDetailName, bare/braced skin rows, layer flags, legacy material flags, Popcorn flags, emitter spellings/flat fields, and multiple DontInherit flags. Community-style output remains the default. Fresnel RGB is not incorrectly reversed. |
| 20–21: numbers and UVs | Read/write authored nan/inf values without silently replacing them. Retain float32 precision instead of six-decimal rounding. Preserve multiple UV sets, accept zero sets, reject newly introduced counts above 16. |
| 22–23: pivots and visibility | Preserve unused/sparse pivots, including through undo and node deletion. Keep static MDL visibility as a scalar; only binary export materializes the required constant track. |
| 24: versions | Synthetic reader/writer and EditorDocument save coverage for 800, 900, 1000, 1100, 1200, 1300, 1400, 1600 and 1800. |

An additional preservation layer copies **unchanged sibling records** directly from the source, even inside a rewritten chunk or MDL collection. It preserves padding, comments, authored track ordering and unmodeled details in those untouched records. Existing unchanged top-level chunks/sections and unchanged whole files still follow the original exact-copy path.

## Verification

Run `pnpm install --frozen-lockfile --ignore-scripts`, then `node --test` (or `pnpm test`). The pinned parser, Buffer, Three.js, and Clipper versions match the bundled component notices; `pnpm-lock.yaml` makes these tests reproducible.

56 tests pass: 53 editor/codec/consumer tests plus the three initial container tests. Fixtures are synthetic and include independently constructed binary material records and byte-level modifications, rather than relying solely on one writer to test its own reader. Checks include:

- Untouched files, unchanged chunks, and unchanged sibling records.
- Paths, model/sequence metadata, high raw flag bits, sparse animated texture slots, colors, splines and static bases behind tracks.
- Signed times, float precision, non-finite source values, all Classic node transforms, Popcorn quaternion W and multiline visibility guides.
- Sparse/unused pivots, history, geoset deletion, DILG remapping, primitive groups, UV limits and zero UV sets.
- Version gates, modern light/camera records, high-ID uint16 bindings, actual CPU skinning and UV uncoupling.
- The existing optimizer's MDL and MDX verification paths.
- Static texture bases behind animated slots follow texture remapping during rig import, part import, and optimization; part texture discovery includes them.
- Explicit rejection of unsafe conversions and preservation-only copies of unsupported data.

## Remaining limitations / release gate

This is **not a claim of universal compatibility or a tested replacement executable**.

1. Resolved for 0.11.1: the renderer source and build/package scripts were restored on `codex/restore-build-source`. The user built, launched, tested, and approved this patch for release. The release rebuilds the renderer so the portable app includes the compatibility changes; this is not a claim that every model or format variant has been exercised.
2. No real-model corpus is present in this checkout. Warcraft III, RMS, and MDLVis have not been run against these outputs. Those interoperability and visual checks remain required, particularly modern HD models and the color conventions in the supplied references.
3. Non-triangle GEOS primitives, SNEM sound emitters, ambiguous duplicate chunks/slots, and unrecognized subchunks are not made editable by guessing. Their original files remain available for exact copying.
4. Some binary data has no documented equivalent in the selected MDL dialect: for example an authored MODL animation filename, nonzero unused header fields, arbitrary unknown flag bits, or camera variant metadata. Conversion that would drop it is rejected. Same-format preservation is the supported path.
5. The supplied references are not internally consistent everywhere. The existing GEOA enable-color bit `0x2` and DropShadow bit `0x1` are retained, consistent with the established community parser. No new camera-based pivot-count rule is imposed: authored pivot arrays are preserved, rather than changed using contradictory reference counts.
6. Unsupported properties on an edited record can still require a targeted codec extension. Deep verification now prevents known modeled values from disappearing; it is not a proof that every unmodeled field in every possible source format has been discovered.

Before release, build this branch with the complete app source, test representative untouched and single-edit models in Warcraft/RMS/MDLVis, and add any real-file failures as regression fixtures. Keep original source models while performing that validation.
