export const PAINT_BRUSH_TIP_SCHEMA = 'mdlxl-paint-brush-tips';
export const PAINT_BRUSH_TIP_VERSION = 1;

const sources = Object.freeze({
  rubberduck: Object.freeze({
    author: 'rubberduck',
    license: 'CC0 1.0',
    sourceUrl: 'https://opengameart.org/content/60-free-gimp-krita-brushes',
    archive: '60-free-gimp-and-krita-brushes.zip',
  }),
  elduderino: Object.freeze({
    author: 'ElDuderino',
    license: 'CC0 1.0',
    sourceUrl: 'https://opengameart.org/content/scratch-damaged-paint-brush',
    archive: 'scratch-damaged-paint-brush.zip',
  }),
});

const rows = [
  ['painted_bristle', 'paint.tip.paintedBristle', 'Brushy Bristle', ['basecoat', 'texture'], 'Brushes/painted-style_574BB1D2.gih', 0, sources.rubberduck],
  ['painted_chisel', 'paint.tip.paintedChisel', 'Chisel Bristle', ['basecoat', 'drybrush'], 'Brushes/painted-style_574BB1D2.gih', 2, sources.rubberduck],
  ['painted_scumble', 'paint.tip.paintedScumble', 'Scumble', ['drybrush', 'texture'], 'Brushes/painted-style_574BB1D2.gih', 4, sources.rubberduck],
  ['fine_grain', 'paint.tip.fineGrain', 'Fine Grain', ['texture', 'wash'], 'Misc/fine-grain_AA4E5565.gih', 0, sources.rubberduck],
  ['surface_scratches', 'paint.tip.surfaceScratches', 'Surface Scratches', ['texture', 'stamp'], 'Misc/scratches_D4F54D42.gih', 0, sources.rubberduck],
  ['armor_cracks', 'paint.tip.armorCracks', 'Armor Cracks', ['texture', 'stamp'], 'Misc/cracks_9CA0DCAE.gih', 0, sources.rubberduck],
  ['chipped_paint', 'paint.tip.chippedPaint', 'Chipped Paint', ['drybrush', 'texture', 'stamp'], 'Brushes/Damaged Paint_4438BAED.gih', 0, sources.elduderino],
  ['scuffed_paint', 'paint.tip.scuffedPaint', 'Scuffed Paint', ['drybrush', 'texture', 'stamp'], 'Brushes/Damaged Paint_4438BAED.gih', 5, sources.elduderino],
];

export const PAINT_BRUSH_TIPS = Object.freeze(rows.map(([id, messageId, name, modes, sourceFile, sourceCell, provenance], index) => Object.freeze({
  id,
  messageId,
  name,
  modes: Object.freeze(modes),
  file: `./paint-brushes/${id}.png`,
  thumbnail: `./paint-brushes/${id}.png`,
  sourceFile,
  sourceCell,
  provenance,
  order: index + 1,
})));

export const PAINT_BRUSH_TIP_MANIFEST = Object.freeze({
  schema: PAINT_BRUSH_TIP_SCHEMA,
  version: PAINT_BRUSH_TIP_VERSION,
  count: PAINT_BRUSH_TIPS.length,
  conversion: 'GIH/GBR grayscale mask to 256×256 RGBA PNG',
  tips: PAINT_BRUSH_TIPS,
});

export function paintBrushTipById(id) { return PAINT_BRUSH_TIPS.find(tip => tip.id === id) || null; }

