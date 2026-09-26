# NormalsXL

In Vertices, select the vertices to correct, then click **NormalsXL** directly below **Merge Geosets**. Click three distinct vertices whose existing normals face the desired side. Each click marks a reference; clicking it again removes it. The third reference corrects the original selection as one undoable edit. Cancel or Escape leaves it unchanged.

The guide is the normalized sum of the three unit reference normals. This is a common-direction tool: normals opposing that guide are negated, retaining their authored slopes and lengths. Correct and perpendicular normals are preserved. It does not infer the inside/outside of an arbitrary closed or folded mesh; select the region that should face the chosen side. Zero target normals cannot be repaired by reversal. Zero, duplicate, missing, or contradictory references are rejected without mutation.

Face winding controls culling independently of vertex lighting normals. Only complete selected triangles facing against the guide are reversed. Boundary triangles, vertex positions, UVs, materials, skinning, animation, other geosets, and the existing Reverse normals command stay unchanged. HD tangent handedness flips only with a flipped normal.

The temporary prompt and normal overlay disappear after correction or cancellation. Picking references does not replace the target selection or create selection-history entries. Document, selection, visibility, mode, and dialog changes cancel a pending pick.

## Research

- [Hive: Recalculating Normals](https://www.hiveworkshop.com/threads/recalculating-normals.238884/): author reports and tool-author discussion about recalculation, manual direction edits, and preserving original vertex/normal ordering.
- [XGM: useful modelling details](https://xgm.guru/p/wc3/useful-modelling-trivias): author describes reversed geometry and why a two-sided material alone does not correct uneven lighting.
- [XGM: Normals in MdlVis](https://xgm.guru/p/wc3/257707): explanation of normals responding to light and the distinction between averaged vertex normals and face normals.

These sources informed the distinction between lighting normals and winding; the implementation and results were verified against the actual MDLxL source and supplied model.

## Verification

Test model: `avner1_HIVE_RELEASE_OPTIMIZED.mdx`, SHA-256 `1a90a1a34a99d40d6907e0bf8dfdde04da0e4320af5cffd880bc33f25bcd3052`. The original was read only. Displayed geoset 19 is index 18, with 338 vertices and 443 triangles. Reference vertex indices 107, 110, and 113 produce guide approximately [0.105681, -0.994400, 0.000001].

| Selection | Reversed normals | Preserved normals | Reversed triangles | Normals still opposed to guide |
| --- | ---: | ---: | ---: | ---: |
| Shield, all 338 vertices | 180 | 158 | 206 | 0 |
| Separate trim pieces, indices 105–214 | 46 | 64 | 31 | 0 |

Both selections passed MDX save/reopen, exact model undo/redo, byte-identical original serialization after undo, repeat no-op, and checks that all unselected normals and other data remain unchanged.

39 focused tests passed, including the new NormalsXL cases, classic mesh tools, selection history, point selection, Quad View, and RGB Preview. The new tests also cover MDL save/reopen and HD tangent handedness. All 56 existing compatibility tests passed.

The rebuilt production bundle was exercised in headless Edge at 1364×900 with real button/vertex clicks: default button placement; three-reference prompt; duplicate pick removal; Escape and Cancel; contradictory references; unchanged target selection and history while picking; correction; one-step Undo/Redo; repeat no-op; serialization. No page errors or native dialogs occurred. Screenshots and the reproduction harness are in the isolated lane's ignored `out/` directory. No desktop windows or user profiles were opened. Warcraft runtime and human visual acceptance remain untested.
