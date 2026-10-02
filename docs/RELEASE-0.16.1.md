# MDLxL 0.16.1

This release fixes EMTR weapon ribbons and NormalsXL repair.

- New fitted EMTR ribbons attach directly to the chosen weapon bone, following the native Blademaster. Saved node IDs, parents, and pivots remain aligned for external editors such as Retera Model Studio. New ribbon materials use Unshaded and TwoSided flags. The fitted edge, soft-disc texture, and checked attack animations are preserved. Recreate ribbons made with the previous faulty creation path to use the corrected attachment.
- NormalsXL no longer aborts a whole-model repair because of a zero-area triangle. Such faces remain in the model but do not constrain orientation. Selected curved surfaces whose normals have collapsed onto one axis can recover local directions from their oriented incident faces. Existing vertex splits, authored normal magnitudes, unrelated surfaces, and the one-reference workflow are preserved.
- Both fixes retain undo/redo and MDL/MDX save support. The user's source models are not modified by installing this update.

MDLxL 0.16.1 includes every change released in 0.16.0.
