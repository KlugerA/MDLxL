/** MDX has two different geoset color layouts: static GEOA is RGB, animated
 * KGAC (including tangents) is BGR. war3-model passes MDX triples through,
 * while its MDL reader/writer already converts textual BGR to/from RGB.
 * Convert ONLY animated MDX colors at both boundaries so every editor and
 * renderer uses RGB. The inverse conversion on export preserves file bytes.
 * Static Color and _MdxDefaults.Color are RGB and must remain untouched.
 * Reference: Retera's mdx/GeosetAnimationChunk.java, GeosetAnimation(GeosetAnim).
 */
export function convertMdxGeosetColorTracks(animations = []) {
  return animations.map(animation => {
    if (!animation.Color?.Keys) return animation;
    return { ...animation, Color: { ...animation.Color, Keys: animation.Color.Keys.map(key => {
      const converted = { ...key };
      for (const field of ['Vector', 'InTan', 'OutTan']) if (key[field]) {
        converted[field] = new Float32Array([key[field][2], key[field][1], key[field][0]]);
      }
      return converted;
    }) } };
  });
}
