# MDL/MDX compatibility audit

Implementation follow-up: see [MDL-MDX-COMPATIBILITY-FIXES.md](MDL-MDX-COMPATIBILITY-FIXES.md). The findings below describe the **pre-fix** checkout; they are retained as the audit record, not the current implementation status.

Audit date: 2026-09-20

Scope: MDLxL 0.11.0 at commit `56d26e1`, its `war3-model` 4.0.1 dependency, and the existing save pipeline.
References: WhiteoutLib MDL specification revision 1.3 and MDX specification revision 2.5.

This is an audit, not a parser rewrite. No parser, model, or save-pipeline architecture was changed.

## Executive result

MDLxL has a strong outer preservation layer but an incomplete semantic layer.

- An untouched file saved in its original format is returned byte-for-byte.
- Unsupported versions and semantically unreadable files are read-only but can still be copied byte-for-byte.
- After an edit, only changed top-level MDL sections or MDX chunks are regenerated; all other top-level data remains byte-for-byte.
- The important failure boundary is therefore the changed top-level chunk. The current semantic model cannot represent every field in several known chunks. Editing one member of such a chunk can rewrite or delete unrelated sibling data in that chunk.
- Save verification reopens the result and compares version, top-level collection counts, UV-set counts, and newly introduced validation errors. It does not compare field values, track keys/tangents, flags, skin indices/weights, paths, primitive groups, pivot values, or opaque sub-records.

Current editable versions are 800, 900, 1000, and 1100. Versions 1200, 1300, 1400, 1600, and 1800 are preservation-only/read-only.

## Priority findings

### P0 — data corruption or unsafe verification in editable files

1. **Version 1100 material sub-texture slots are decoded and encoded incorrectly.** The dependency reads the stored `slot` but assigns sub-textures by loop position. Its writer emits slot `0` for every animated sub-texture. Sparse, reordered, duplicated, or animated slots can be remapped when any material edit regenerates `MTLS`. This can attach the wrong diffuse/normal/ORM/emissive/team/reflection texture and damage texture animation.

2. **The save verifier cannot detect most semantic corruption.** A regenerated chunk passes when it remains parseable and has the same item counts. Changed values, missing tracks, reset flags, altered paths, remapped bindings, changed pivots, or changed skin weights can pass verification.

3. **Known fixed-size fields are missing from the model.** `MODL.animationFileName` is discarded; `SEQS.syncPoint` is discarded and rewritten as zero. Editing model info or any sequence can therefore delete unrelated values from the same chunk.

4. **Static and animated GEOA colours use inconsistent in-memory channel order.** MDX stores both static `color` and `KGAC` keys in BGR order. MDLxL swaps only animated `KGAC` keys to editor RGB. Static MDX tints are consequently interpreted as RGB without conversion, while newly authored static RGB is written as if already BGR. Red/blue can swap in preview, MDL conversion, or saved GEOA edits.

5. **Signed animation times are not supported end to end.** The specifications permit negative `i32` keyframe and event times. The dependency stores event times in `Uint32Array`, and MDLxL validation and editing reject negative frames. Negative values can become large positive times on MDL conversion or prevent an otherwise valid edit/save.

### P1 — destructive chunk regeneration or major compatibility gaps

6. **GEOS loses primitive-group and selection detail.** The reader accepts only primitive type 4 (triangles), discards the `PTYP` and `PCNT` arrays, reduces the raw selection word to a boolean, and the writer always emits one triangle group and selection flags `4` or `0`. Editing any geoset can canonicalize unrelated group boundaries and raw selection flags. Primitive types 0–3 and 5–9 are rejected.

7. **Reforged 1400+ skinning is unsupported.** The model stores `SkinWeights` as bytes and assumes eight bytes per vertex. Version 1400 widens every SKIN element to `u16`; reading it as bytes stops halfway through the payload and misaligns UV parsing. The read-only version gate currently prevents writes, but versions 1400 and 1800 cannot be edited until the representation, tools, validation, and writer all support 16-bit bone IDs.

8. **Ribbon colour animation is unsupported.** `KRCO` is absent from the model and writer. A ribbon containing `KRCO` fails semantic decode; conversion or future partial handling would lose it.

9. **Plane and cylinder collision shapes are unsupported/malformed.** The model enum contains only Box and Sphere. The reader/writer treats every non-Box as one vertex and gives a radius only to Sphere. Plane needs two vertices; Cylinder needs two vertices plus a radius.

10. **Classic light attenuation tracks use the wrong value type.** `KLAS` and `KLAE` are `f32` tracks, but the dependency reads and writes them as integer tracks. Non-integral values and spline tangents can change when `LITE` is regenerated.

11. **Several 260-byte path fields are treated as 256 bytes plus a zero word.** `TEXS.fileName`, `ATCH.path`, and `PREM.spawnModelFileName` lose bytes 256–259 when their chunk is regenerated. Ordinary short paths are unaffected, but the format allows 260 bytes.

12. **Current camera data is not represented.** The camera header is treated as a plain inclusive size instead of low-24-bit size plus high-byte variant. `KCVS`, `IDUF`, `ELAF`, and `PTSF` are absent. A version-1800 camera would be catastrophically mis-sized without the current read-only gate.

13. **Current light data is not represented.** Version-1200 shadow intensity, version-1300 shadow casting/start/end and `KLSS`/`KLSE`, and version-1600 falloff/damping and `KLQF`/`KLLF`/`KLDA` are absent. The required pre-1600 defaults `0.0005`, `0`, and `0.00001` are also absent.

14. **Top-level SNDS, SNEM, and DILG/Glider are opaque only.** Same-format edits to other chunks preserve them, which is safe. They are reported as unknown and the user-facing Save As preflight blocks conversion; the semantic model cannot inspect, edit, validate, or remap their references. The lower-level `EditorDocument.serialize(otherFormat)` API does not itself enforce that opaque-data block, so callers that bypass the preflight can still drop them.

### P2 — MDL dialect, defaults, pivots, and validation gaps

15. **Engine-faithful MDL v1100 syntax is not accepted or emitted.** The dependency does not parse the `<= slot` designator or per-layer `Shader "name"`; it emits the Hive-style `ShaderTypeId` and named texture-slot properties instead.

16. **Appendix A support is only partial.** Hive named texture slots, `ShaderTypeId`, and braced SkinWeights rows are supported. `SortPrimitives`, `SelectionFlags`, and `LevelOfDetailName` are not. The writer emits `SortPrimsFarZ`, `Name`, and braced SkinWeights, so its output is neither fully engine-faithful nor fully Appendix-A faithful.

17. **Engine SkinWeights rows are not parsed.** The engine dialect uses bare groups of eight integers; the dependency expects Hive-style brace-wrapped rows. Valid engine MDL HD geosets can therefore become read-only.

18. **Several flags and spellings are absent from the MDL semantic reader/writer.** Layer `WrapWidth`, `WrapHeight`, `Unlit`, `BackFacesForShadows` (`0x200`), and `AmbientOcclusion` (`0x400`), material `SortPrimsNearZ`, `Unfogged`, and material `TwoSided`, and Popcorn `PopcornScaling` are incomplete or missing. The dependency also accepts/emits the community-style `EmitterUsesMDL` / `EmitterUsesTGA` spellings, not the engine reference's `EmitterUsesMdl` / `EmitterUsesTga`. Raw MDX flag words generally survive same-format regeneration, but MDL input/output and format conversion do not.

19. **Node non-inheritance syntax diverges from the reference and has a self-round-trip bug.** The writer emits `DontInherit { ... }`; the current specification uses individual `DontInheritTranslation`, `DontInheritRotation`, and `DontInheritScaling` flags. The dependency parser reads only one entry from its own aggregate form, so a node with multiple non-inheritance flags can produce MDL that fails the reopen verification.

20. **Non-finite MDL numbers are rejected.** Shipped `nan`, `inf`, and `-inf` values are valid per the reference but the dependency number parser cannot read them. The lossless lexer retains the bytes, but semantic editing is unavailable.

21. **UV preservation is mostly good but validation is incomplete.** MDX reads/writes all UV sets, and MDLxL patches the dependency writer so additional MDL `TVertices` blocks are retained. It does not enforce the engine's maximum of 16 UV sets; an edited file with 17 or more sets can be written but rejected by Warcraft III.

22. **Pivot preservation is defensive but not validated against the model topology.** MDLxL separately parses sparse `PivotPoints` and retains unused indices as zero pivots, preventing the dependency's sparse-ID crash. Node creation/deletion is blocked when bind poses exist. However there is no invariant check for required pivot count/order, camera pivots are not modeled, and save verification checks only array count rather than values or node/camera correspondence.

23. **Static visibility normalization rewrites representation.** Numeric visibility on a node is replaced with a stepped track at frame 0 and every sequence boundary. This helps bridge MDL static values to MDX chunks that have only a track, but regenerating that node chunk changes unrelated authored representation and can add many keys.

24. **Version-900 support is explicitly experimental.** Its principal version gates match the reference (shader/emissive at 900; fresnel at 1000), but it inherits every common issue above.

## Version matrix

| Version | Current status | Main audit result |
| --- | --- | --- |
| 800 | Editable | Core SD data works; exposed to MODL/SEQS/path, signed-time, light-track, ribbon, collision, GEOS, MDL-dialect, and verification issues. |
| 900 | Editable, warned experimental | Adds shader/emissive, LOD, TANG/SKIN-u8, BPOS/FAFX/CORN; missing flags/default fidelity remains. |
| 1000 | Editable | Fresnel fields/tracks are gated correctly; common losses remain. |
| 1100 | Editable, unsafe for general MTLS edits | SubTexture slot handling is a P0 corruption risk; text output is Hive-like and only partially compatible. |
| 1200 | Read-only exact-copy | Shipped Reforged corpus version; light shadow intensity missing. |
| 1300 | Read-only exact-copy | Shadow-casting fields/tracks missing. |
| 1400 | Read-only exact-copy | `u16` SKIN missing. |
| 1600 | Read-only exact-copy | Falloff/damping fields, tracks, and defaults missing. |
| 1800 | Read-only exact-copy | Current shipped version; accumulated light/skin changes plus camera variants/tracks and DILG missing. |

## Save-pipeline assessment

| Operation | Preservation today |
| --- | --- |
| Open and save untouched in the same format | Exact original bytes. This is the strongest path. |
| Copy an unsupported/read-only file in the same format | Exact original bytes. |
| Edit one top-level section/chunk and save in the same format | Untouched chunks are exact; the whole changed chunk is regenerated and is only as lossless as the semantic model. |
| Convert MDL to MDX or MDX to MDL | Entire file regenerated. The user-facing preflight blocks unknown top-level data, but direct low-level serialization does not; unsupported fields inside known chunks are not inventoried and may disappear. |
| Desktop disk write | Temporary file, read-back byte comparison, then rename. This verifies disk I/O, not model semantics. |

## Tests added in this audit

`tests/lossless-roundtrip.test.js` uses Node's built-in test runner and covers:

- byte-exact preservation of a v1800 MDX carrying DILG and an unknown chunk;
- byte-exact recovery output even when an MDX has malformed trailing bytes;
- byte-exact lexical preservation of mixed engine/HiveWorkshop MDL syntax, CRLF, comments, named slots, slot designators, braced SkinWeights, selection flags, and LOD names.

These tests exercise the repository's dependency-free lossless container layer. This checkout does not include `node_modules`, a lockfile, fixtures, or the full dependency manifest described by its README, so executable `EditorDocument` semantic round-trip tests cannot be made reproducible here without first restoring the pinned application dependencies and representative model corpus.

## Recommended implementation order

1. Add deep changed-chunk equivalence checks and fixtures first, so later fixes cannot silently regress unrelated fields.
2. Fix the v1100 SubTexture representation and reader/writer slot handling.
3. Add lossless fields for animation file name, sync point, raw geoset primitive/selection data, signed times, and 260-byte paths.
4. Normalize all GEOA static and animated colours consistently and lock it with red/blue sentinel fixtures.
5. Complete Classic structures (`KRCO`, collision Plane/Cylinder, float KLAS/KLAE) and MDL dialect dual parsing/writing.
6. Add v1200, v1300, v1400, v1600, and v1800 model fields and version gates, then remove each read-only gate only after corpus round trips pass.
7. Add a corpus gate: unchanged byte-exact same-format save; edited-chunk semantic equality for all untouched fields; MDX→MDL→MDX equivalence where the target dialect can represent the source.
