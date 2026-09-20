# Forge owner reference fixtures

These fixtures are derived from the original owner-supplied references recovered in the Forge contract dated 10 September 2026.

- `R01-447-mask.bin`: 447 × 447 bytes in row order, one byte per pixel, retained when mean source RGB < 180 and alpha > 0. Derived from `references/R01-source-image.png` in the supplied `forge-next-patch` package. Contains two components and their eye / loop holes.
- `R02-outline.json`: original 34 front boundary positions from `references/R02-trimmed-shield.mdl`, projected from X/Z into source-image coordinates. Coordinates are uniformly scaled into a 256 × 256 image with 13-pixel padding; model aspect ratio and all authored corners are preserved. This is a planar input to test the outward frame and existing Bend operation, not a copy of the original curved mesh.

Reference source files remain unchanged. The reference models have respectively 130 vertices / 260 triangles and 278 vertices / 268 triangles. The tests compare practical topology and export cost rather than requiring identical connectivity.
