# Texture library metadata

`texture-library-catalog.json` is a compact metadata-only adaptation of the user's WC3 Texture Atlas catalog from the task “Build WC3 texture reference site.” It preserves native texture paths, user-provided/reviewed material descriptions, search traits and annotated regions. The source catalog contains 6,114 Classic entries. Image/thumbnail file references were removed; no atlas texture images are bundled here.

Search language modules under `src/texture-library/` are reused from that user-authorized atlas source. Native texture bytes and browse thumbnails are obtained from the user's Warcraft III installation at runtime. Native CASC paths/content keys are enumerated and cached by the local CascLib bridge; this metadata file does not claim coverage of every game patch or Reforged appearance.

The optional Warhammer and Middle-earth search associations are suggestions for adapting Warcraft textures, not claims of native assets from those franchises.
