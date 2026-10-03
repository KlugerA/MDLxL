# MDLxL 0.13.2

- Save complete Showcase recording sets, reopen and edit them independently, drag recordings into order, and replace a queued model without resetting the surrounding setup.
- Keep recording duration tied to the authored animation plus explicit extra time; legacy recording-state duration data no longer invents additional time.
- Target practical local GIF sizes when no export profile is selected: about 50 MB for a ten-second Medium recording and 100 MB for High. The Hive encoding limit is unchanged.
- Fix white/opaque-looking transparent alpha-cutout edges in the preview.
- Show Materials and Geosets with one-based visible numbers while preserving their underlying references.

## Validation

Focused Showcase, GIF profile, capture-settings, resource-numbering, export, layout, and model tests pass (20 source checks). The packaged Electron Showcase layout regression passes, including recording crops, Hive behavior, model replacement, and retained setup. The queued-model Electron regression is not run because its two user-model fixture paths are absent on this release machine.

Extract the complete Windows ZIP to run the release. Preserve your existing `resources/app/profile` and personal Addons, Backgrounds, BitsAndParts and Showcase Recordings when replacing a portable installation.
