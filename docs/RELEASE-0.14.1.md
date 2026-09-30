# MDLxL 0.14.1

This patch adds selected-geoset triangle density controls to Forge and the UV Wrapper.

- More density rebuilds stretched surfaces as evenly spread square-like cells, each split once for UV wrapping.
- The density control stops at the useful six-cell grid and cannot be repeatedly applied to create excess topology.
- Less density retains protected borders and authored vertex records.
- Focused Skeleton keeps the highlighted bone markers visible with Bones either on or off; unrelated bone markers remain hidden when Bones is off.

Version 0.14.1 includes all changes released in 0.14.0.
