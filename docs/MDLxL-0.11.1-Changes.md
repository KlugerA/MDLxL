# MDLxL 0.11.1

Accepted MDL/MDX preservation patch, with the restored interface source and a rebuilt Windows x64 portable app.

## Download and run

Download `MDLxL-0.11.1-win32-x64.zip` from this release's Assets, extract the entire ZIP into a new folder, and open `MDLxL.exe` inside `MDLxL-win32-x64`. Do not run it inside the ZIP or copy just the EXE. No Node.js, pnpm, or installer is needed for the portable download. Keep your existing installation and original models until you have checked your own files.

## Included

- The accepted compatibility changes preserve untouched records and improve material slots, animation tracks, RGB, paths, pivots, UVs, skin bindings, and modern model data.
- Save verification reopens generated files and rejects detected data changes instead of silently writing them.
- The complete restored interface/build source is included in Git. The portable renderer was rebuilt from it.
- Packaging resolves pnpm dependency links correctly, includes complete bundled dependency notices, and preserves pinned FFmpeg files byte-for-byte.
- Default Backgrounds, Addons, and the empty BitsAndParts library were restored from the original distribution. No personal models, texture caches, profiles, or settings are included.

## Verification and limits

- All 56 compatibility regression tests pass.
- Production renderer build passes.
- Package checks verify 533 application/asset files and 55 Electron locale files.
- The packaged EXE was launched with an isolated temporary profile; its actual renderer loaded the editor interface successfully.
- The user tested and accepted the source-launched patch before requesting this release.
- The restored historical suite is not fully passing. Some assertions describe the old format restrictions; others expose remaining save rejections, including certain empty-geoset and unset material-field cases. Disabled cached colors that MDL cannot express can also cause conversion/save rejection. Do not interpret this release as universal format compatibility or an all-green historical suite.
- Warcraft, RMS, and MDLVis interoperability has not been independently revalidated for every supported version or model. Use Save As and retain originals.

Full scope and preservation limitations: [compatibility fix report](MDL-MDX-COMPATIBILITY-FIXES.md).
