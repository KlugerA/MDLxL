# MDLxL 0.13.1

- Fix filled polygons connecting circular vertex markers in the preview overlay. The small v0.13.0 patch was confirmed working by the affected user.
- Make native dropdowns, coordinate, RGB and global-sequence labels, selected resource rows, Paint options, and Showcase error text readable across all seven themes.
- Use the light brush-tip palette in Silvermoon and allow importing valid exported configurations with larger embedded backgrounds.
- Translate Showcase controls, presets, dialogs, tooltips, effects, recording progress and errors in Russian, Spanish and Chinese; extend the existing Mordor mode. Keep authored names, file paths and text layers literal.
- Include the UV team-color correction, occupied-frame startup, black unused space with wrapping disabled, and the 2.5 default scroll sensitivity with normal pointer DPI.

## Validation

Native Electron checks cover 189 marker combinations, 63 wire combinations, 12 background combinations, preset persistence and configuration import, plus 182 theme/screen contrast combinations. The combined focused source, UV and compatibility checks pass (149 passed, one skipped). Native UV wrapping verification also passes with undo/redo and black-space pixel checks. Model bytes remain unchanged during appearance tests.

The broad historical suite is not green: its audit reported 1049 passed, 18 failed and two skipped, including an existing timeline test that hung and was terminated. These failures are separate from the focused change validation; the existing localization brand-list failure was corrected in this patch.

Extract the complete Windows ZIP to run the release. Preserve your existing resources/app/profile and personal Addons, Backgrounds, BitsAndParts and Showcase Recordings when replacing a portable installation.
