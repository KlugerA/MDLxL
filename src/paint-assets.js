import { PAINT_ASSET_SCHEMA, PAINT_ASSET_VERSION } from './paint-types.js';
import { createPaintRaster, rgbaColor } from './paint-raster.js';

const generated = Object.freeze({ kind: 'generated-original', license: 'MDLxL project asset', sourceUrl: null, author: 'MDLxL project', generation: { provider: 'OpenAI ImageGen', date: '2026-09-11', recipe: 'warcraft-sd-miniature-material-v1' } });
const cc0 = (sourceUrl,downloadUrl,author) => Object.freeze({ kind: 'cc0-derived', license: 'CC0 1.0', sourceUrl, downloadUrl, author, generation: { method: 'palette recolor, resize and seamless-edge normalization', date: '2026-09-11' } });
const hairCC0 = cc0('https://opengameart.org/content/hair-texture','https://opengameart.org/sites/default/files/hair_0.jpg','Dugi');
const furCC0 = cc0('https://opengameart.org/content/4k-seamless-textures-public-domain','https://opengameart.org/sites/default/files/4KSeamlessTextures.zip','Behrtron');
const metalCC0 = cc0('https://opengameart.org/content/texture-pack-seamless-metalpng-0','https://opengameart.org/sites/default/files/metal.png','Heathal');
const reptileCC0 = cc0('https://opengameart.org/content/reptile-skin','https://opengameart.org/sites/default/files/lizard_skin.png','RooMan93');

const rows = [
  ['human_fair','Human Fair Skin','skin','#c58d72','#7a493e'],['human_tan','Human Tan Skin','skin','#a96f4c','#633928'],['human_deep','Human Deep Skin','skin','#74452f','#3b241c'],
  ['orc_green','Orc Green Skin','skin','#718b45','#35472d'],['orc_olive','Orc Olive Skin','skin','#7d7a3f','#403d25'],['orc_dark','Orc Dark Skin','skin','#465b35','#243120'],
  ['nightelf_violet','Night Elf Violet Skin','skin','#76628e','#413a61'],['nightelf_dusky','Night Elf Dusky Skin','skin','#5e526f','#302b43'],['highelf_warm','High Elf Warm Skin','skin','#d2a17e','#805745'],
  ['undead_pallid','Undead Pallid Flesh','skin','#a6a88c','#555a4c'],['undead_rotted','Undead Rotted Flesh','skin','#737552','#363c31'],['undead_desiccated','Undead Desiccated Flesh','skin','#88735c','#463a31'],
  ['demon_crimson','Demon Crimson Flesh','skin','#8e3d36','#431f26'],['demon_charred_fel','Demon Charred Fel Skin','skin','#443c37','#172d22',reptileCC0],
  ['hair_black_locks','Black Hair Locks','hair-fur','#25272b','#08090b'],['hair_brown_locks','Brown Hair Locks','hair-fur','#5b3c28','#241a15',hairCC0],['hair_golden_locks','Golden Hair Locks','hair-fur','#bd8e3f','#5b3e20'],['hair_silver_locks','Silver Hair Locks','hair-fur','#b8bdc4','#555d68'],
  ['fur_coarse_brown','Coarse Brown Fur','hair-fur','#6f4b30','#2e211a',furCC0],['fur_black','Black Fur','hair-fur','#2b2d31','#090a0c',furCC0],['fur_grey_wolf','Grey Wolf Fur','hair-fur','#7f8589','#34383e',furCC0],['fur_white_winter','Winter White Fur','hair-fur','#d6d5ca','#777b7b',furCC0],
  ['polished_steel','Polished Steel','metal','#9ca9b5','#394550'],['human_blue_steel','Human Blue Steel','metal','#738da8','#2d4058'],['hammered_steel','Hammered Steel','metal','#858e96','#343b42',metalCC0],['battered_iron','Battered Iron','metal','#62666a','#26282c',metalCC0],['orc_black_iron','Orc Black Iron','metal','#454844','#171b18'],['undead_rusted_iron','Undead Rusted Iron','metal','#76543e','#2c2926'],['bronze','Bronze','metal','#9a683e','#4b3428'],['antique_gold','Antique Gold','metal','#ae8743','#554322'],['elven_moonsilver','Elven Moonsilver','metal','#aebcc5','#536478'],['demon_fel_iron','Demon Fel Iron','metal','#3e5043','#17261e'],
  ['smooth_brown_leather','Smooth Brown Leather','leather-cloth','#754b2f','#38261d'],['cracked_dark_leather','Cracked Dark Leather','leather-cloth','#46352b','#1d1816'],['rawhide_stitched','Rawhide Stitched Leather','leather-cloth','#a5754f','#513a2d'],['coarse_linen','Coarse Linen','leather-cloth','#a99b76','#5c5545'],['undead_tattered_cloth','Undead Tattered Cloth','leather-cloth','#59594a','#292c27'],['elven_weave','Elven Weave','leather-cloth','#526c70','#293d48'],
  ['bone_ivory','Bone and Ivory','bone-wood','#c4b68d','#665c49'],['weapon_haft_bow_wood','Weapon Haft and Bow Wood','bone-wood','#76502e','#38271b'],
];

const stampRows = [
  ['eyes_human_elf','Human and Elf Eyes','#dce7ef','#25445c'],['eyes_orc','Orc Eyes','#e8bd42','#4c261d'],['eyes_nightelf_glow','Night Elf Glowing Eyes','#7de4ff','#2f57a4'],['eyes_undead','Undead Eyes','#a6ef72','#344d2c'],['eyes_demon_fel','Demon and Fel Eyes','#78ff70','#204b2b'],
  ['teeth_tusks_fangs_claws','Teeth, Tusks, Fangs and Claws','#d8cba2','#665848'],['scars_wounds','Scars and Wounds','#9b4943','#442026'],['stitches_seams_lacing','Stitches, Seams and Lacing','#c1aa82','#3f3024'],['rivets_dents_plate_edges','Rivets, Dents and Plate Edges','#a2a9ad','#343a3d'],['markings_grime_blood','Markings, Grime and Blood','#7c302b','#261c1b'],
];

function asset(row, index, kind = 'material') {
  const [id,name,category,baseColor,accentColor,provenance = generated] = row;
  const files = Object.freeze({ 256: `./paint-assets/256/${id}.png`, 512: `./paint-assets/512/${id}.png` });
  return Object.freeze({ id, name, category, kind, baseColor, accentColor, tags: [category, ...name.toLowerCase().split(/\s+/)], provenance, files, thumbnail:files[256], valueFiles: kind === 'material' ? Object.freeze({ 256: `./paint-assets/256/${id}_value.png`, 512: `./paint-assets/512/${id}_value.png` }) : null, order: index + 1 });
}

export const PAINT_ASSETS = Object.freeze([...rows.map((row,index)=>asset(row,index)), ...stampRows.map((row,index)=>asset([row[0],row[1],'stamp',row[2],row[3]],rows.length+index,'stamp'))]);
export const PAINT_ASSET_MANIFEST = Object.freeze({ schema: PAINT_ASSET_SCHEMA, version: PAINT_ASSET_VERSION, style: 'Classic Warcraft III SD hand-painted miniature materials', resolutions: [256,512], logicalAssetCount: PAINT_ASSETS.length, materialCount: rows.length, stampCount: stampRows.length, assets: PAINT_ASSETS });

export function paintAssetById(id) { return PAINT_ASSETS.find(asset => asset.id === id) || null; }

/** A manual color choice clears materialId, so a previously selected shelf texture must not keep painting. */
export function selectedPaintMaterialRaster(brush, selectedAssetId, raster) {
  return brush?.materialId && brush.materialId === selectedAssetId ? raster : null;
}

const hash = (x, y, seed) => { let value = Math.imul(x + seed * 17, 374761393) ^ Math.imul(y + seed * 29, 668265263); value = Math.imul(value ^ value >>> 13, 1274126177); return ((value ^ value >>> 16) >>> 0) / 4294967295; };
const mix = (a, b, amount) => Math.round(a + (b - a) * amount);

/** Deterministic offline fallback while also serving as asset loading QA. */
export function proceduralPaintAssetRaster(asset, size) {
  const output = createPaintRaster(size), base = rgbaColor(asset?.baseColor), accent = rgbaColor(asset?.accentColor), seed = Math.max(1, asset?.order || 1), stamp = asset?.kind === 'stamp';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size, v = (y + .5) / size, fine = hash(x >> 1, y >> 1, seed), coarse = hash(x >> 4, y >> 4, seed), strand = (Math.sin((u * (asset?.category === 'hair-fur' ? 54 : 10) + v * 5 + coarse) * Math.PI) + 1) / 2;
    let amount = .12 + coarse * .18 + fine * .08, alpha = 255;
    if (asset?.category === 'hair-fur') amount = .12 + strand * .42 + fine * .12;
    if (asset?.category === 'metal') amount = .08 + Math.pow(coarse, 2) * .3 + Math.max(0, Math.sin((u + v * .18) * Math.PI * 4)) * .14;
    if (asset?.category === 'leather-cloth') amount = .16 + Math.abs(Math.sin((u + fine * .05) * size / 4) * Math.sin((v + coarse * .03) * size / 4)) * .18;
    if (asset?.category === 'bone-wood') amount = .1 + strand * .22 + coarse * .13;
    if (stamp) { const dx = u - .5, dy = v - .5, ring = Math.abs(Math.hypot(dx, dy) - (.17 + (seed % 4) * .035)), slash = Math.abs(dy - Math.sin((u * (3 + seed % 4)) * Math.PI) * .12); alpha = Math.round(Math.max(0, 1 - Math.min(ring * 18, slash * 15)) * 255); amount = .15 + fine * .18; }
    const offset = (y * size + x) * 4; output.data[offset] = mix(base[0], accent[0], amount); output.data[offset + 1] = mix(base[1], accent[1], amount); output.data[offset + 2] = mix(base[2], accent[2], amount); output.data[offset + 3] = alpha;
  }
  return output;
}
