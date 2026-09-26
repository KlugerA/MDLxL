# NormalsXL

In Vertices, select the vertices to correct, then click **NormalsXL** directly below **Merge Geosets**. Click three distinct vertices whose normals already face out of their surface (or into it, to choose inward). The references can face different world directions. The third pick corrects the original selection as one undoable edit. Click a reference again to remove it; Cancel or Escape leaves the document unchanged.

## Surface orientation

NormalsXL follows connected surfaces instead of putting every normal into one global hemisphere. It establishes consistent triangle winding through shared edges, including exact geometric edges across vertex seams. It estimates each curved piece's outward orientation using signed volume about that piece's centroid. The three references choose the inside/outside polarity relative to their local surfaces. Flat pieces use references on that piece or the direction of the reference normals.

Only selected normals and fully selected triangles can change. Ordinary normals retain their authored slope and magnitude, with their sign corrected relative to the local surface. When different connected pieces share an authored normal, reversing only one piece can require a new shared direction. The tool recognizes geometric smoothing by matching the authored axis to a sum of unit vertex normals under possible component orientations, then rebuilds that shared direction from the corrected surfaces. Unit vertex normals come from sums of unit face normals. Opposite-facing surfaces are kept separate. Custom slopes without that geometric explanation are preserved. Inference for unusually large ambiguous shared groups is bounded; those normals still receive individual sign correction. HD tangents retain handedness on reversal and are reprojected when a shared normal changes.

This is not a general inside/outside proof for arbitrary open, intersecting, nested, or non-orientable meshes. Centroid-based signed volume is an estimate on open curved pieces, verified here against the supplied shield. Conflicting references and selected non-manifold or non-orientable surfaces produce an inline error without a partial edit. A flat surface perpendicular to the available guide requires references on that surface. A zero normal cannot be repaired by reversal.

Positions, UVs, materials, rigging, animations, other geosets, unselected normals, and boundary triangles remain unchanged. The existing Reverse normals command remains unchanged. The temporary reference prompt and overlay disappear after correction or cancellation. Picking references does not replace the target selection or add selection-history entries.

## Acceptance evidence

The supplied manually corrected **v1 (Fixed Shield Normals).mdx** is the acceptance reference. Comparison is restricted to shield geoset 19 (index 18), with 338 vertices and 443 triangles. Its unrelated extent and emitter changes are not copied. The production algorithm contains no model names, hashes, geoset numbers, vertex IDs, or expected counts.

| Input, all shield vertices selected | Negated normals | Recomputed shared normals | Reversed triangles | Maximum normal-vector error versus V1 |
| --- | ---: | ---: | ---: | ---: |
| Original avner1 model | 193 | 59 | 355 | 0.000000137 |
| Rejected V2 button output | 126 | 59 | 195 | 0.000000137 |
| Accepted V1 | 0 | 0 | 0 | 0 |

All 338 normal directions and all 443 triangle orientations match V1. The original has three inward-facing connected pieces (355 triangles) and 22 correctly oriented spike pieces (88 triangles). The corrected original's face array matches V1 exactly. Corrected V2 has equivalent cyclic triangle ordering. Repeating the operation makes no change. Selecting only the 110 spike vertices also matches their V1 normals and preserves every unselected vertex and boundary triangle.

References used in the reproducible local checks: vertex indices 107, 110, 113 on geoset index 18. Input SHA-256 values, verified unchanged after testing:

- Original: `1a90a1a34a99d40d6907e0bf8dfdde04da0e4320af5cffd880bc33f25bcd3052`
- Rejected V2: `244c4b7da602b784781b3b930f89162adbd5e408db58afc91b92c9753053b416`
- Accepted V1: `a769d80a32b6eb554bf30d027f9bd896a294bcc1cd84e1b24f7877e3923597b1`

102 focused and compatibility tests passed, including 14 NormalsXL tests for curved surfaces, opposite-facing references, mixed winding, inward selection, authored slopes, shared smoothing, repair after mixed reversals, partial selection, UV seams, HD tangents, transformations, validation, undo/redo and MDX/MDL roundtrips.

The rebuilt production bundle was tested in headless Edge with actual button and vertex clicks on all three supplied models. Checks passed for duplicate reference toggling, Escape, Cancel, contradictory references, preserving target selection, one-step undo/redo, saving, and repeat no-op. V1 remains an exact no-op with no new undo entry. No page errors or native dialogs occurred.

With normal overlays enabled, left, right, and perspective viewport screenshots are byte-identical between corrected original, corrected V2, and accepted V1. The viewport PNG SHA-256 values are:

- Left: `98a7e6487ee1933a49faa7db19a007f1cb5e53cfcea881a62251b9917d848210`
- Right: `348a92c3035c6d5136d341904c57cfc8c756f0dcb5e2b36990c61f131451146f`
- Perspective: `3f3e2e4b648fea6a6a984cc4d71d6d3276bc0082c561b2a48de616c16ff774c2`

Local audit scripts, saved test copies, and screenshots are in the isolated worktree's ignored `out/` directory. Supplied models were read only and are not committed. This revision was tested internally without opening new desktop windows. Warcraft runtime and human acceptance of this revision remain untested. It is an isolated draft PR, not a main-branch or release update.

## Research

- [Hive: Recalculating Normals](https://www.hiveworkshop.com/threads/recalculating-normals.238884/): tool-author discussion of recalculation, manual direction edits, and preserving vertex/normal ordering.
- [XGM: useful modelling details](https://xgm.guru/p/wc3/useful-modelling-trivias): reversed geometry and why a two-sided material alone does not correct lighting.
- [XGM: Normals in MdlVis](https://xgm.guru/p/wc3/257707): vertex normals, averaging and lighting.
- [CGAL Polygon Mesh Processing](https://doc.cgal.org/6.0/Polygon_mesh_processing/index.html): consistent orientation and per-component outward orientation, including the closed-mesh requirements of volume-bounding operations.

These sources informed the distinction between vertex lighting normals, face winding, and connected-surface orientation. The shared-smoothing rule and shield result were derived and verified from the supplied original, rejected V2, and accepted V1 data.
