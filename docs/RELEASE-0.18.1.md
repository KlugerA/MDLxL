# MDLxL 0.18.1

- Fix edited MDL/MDX node ordering and remap parents, mesh bindings, skin weights, pivots, and bind poses together. Repeated saves and recovery retain the correct source baseline; unchanged lossless saves remain byte-exact.
- Correct static ParticleEmitter2 width/length encoding, animated light/ribbon colors and tangents, Popcorn defaults, and generated MDL formatting.
- Preserve camera bind poses when adding/removing bones and avoid invalid bounds when copying geosets with empty animation extents.
- Fix the first particle-preview replay after editing.
- Replace the Showcase Friz Quadrata font with OFL-licensed Marcellus. Existing saved font selections continue to work. Include the font's license and updated notices.

Includes the 0.18.0 resource managers, Appearance controls, adjustable Paint crops, 31 curated Paint textures, and UV texture-chain replacement.

Validation: 175 focused source/compatibility tests and 106 saved files loaded and checked through Retera's independent model loader. These cover native assets, editor actions, repeated saves, and synthetic classic/Reforged node features. See [the compatibility verification report](SAVE-COMPATIBILITY-VERIFICATION.md) for exact coverage and remaining limits. Lossy MDL conversions remain blocked. Native MDLvis and in-game playback were not exercised.

Extract the whole Windows ZIP and run MDLxL.exe. Keep its folders together. The FFmpeg corresponding-source archive and English/Russian Paint guides accompany the Windows download.
