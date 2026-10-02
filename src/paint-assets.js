import {PAINT_ASSET_SCHEMA,PAINT_ASSET_VERSION} from './paint-types.js';
import {createPaintRaster} from './paint-raster.js';

// Pixel rectangles were inspected against the installed Classic textures.
// Recipes ship; game pixels are read from the user's configured Warcraft data.
const campaign='ui\\glues\\singleplayer\\humancampaign3d\\';
const sources={
  grunt:['textures\\grunt.dds',256,256,'f13e6f218c568aeaa0c78fb30c83c85e3be134f3f4443359a530a98f9c936383'],
  peasant:['textures\\peasant.dds',256,256,'85f7f0aae99e75900812cf155babf2bb14a5b3449795f2a0eb8231697da270b2'],
  cinematic:[campaign+'humancampaignfootman.dds',256,256,'9e3220a871b64cf4a86be43f54556eaa64ff47d4391e16565b9fd3d83f36a21a'],
  wood:[campaign+'humancampaignwoodmetaltrim.dds',256,64,'f7d74b1580f5bc4e36840830ee606fbf8616b4fbf4d616d71ef8966aa8797f3d'],
  crate:[campaign+'crates02sides.dds',128,64,'bbd4ab979bd23df5679bcca6bc881397911b46e6145b8332dbe96153de50edbe'],
  cloth:[campaign+'humancampaignloincloth.dds',128,256,'1adc95106ab7a962dec6d90acad53d95e5c79c8899968c61b47888706f085dd7'],
  smith:['buildings\\human\\blacksmith\\newblacksmith.dds',256,256,'3e071a909fb4a9569678d34b375efc40a6d563c24a92f26b5b1e6be6f6ad244c'],
};
const rows=[
  ['wc3-chainmail','Footman chainmail','Metal','cinematic',[32,149,72,72]],
  ['wc3-steel','Silver plate','Metal','cinematic',[162,117,61,34]],
  ['wc3-dark-steel','Dark plate','Metal','cinematic',[8,5,109,23]],
  ['wc3-riveted-plate','Riveted plate detail','Metal','cinematic',[2,75,120,52],'detail'],
  ['wc3-copper','Blacksmith copper','Metal','smith',[213,148,39,25]],
  ['wc3-orc-skin','Grunt skin','Skin','grunt',[17,34,22,24]],
  ['wc3-human-skin','Peasant skin','Skin','peasant',[207,183,23,34]],
  ['wc3-leather','Peasant leather','Leather & cloth','peasant',[74,49,36,27]],
  ['wc3-blue-cloth','Blue cloth','Leather & cloth','cloth',[40,198,48,32]],
  ['wc3-wood','Dark wood grain','Wood','wood',[6,8,240,47]],
  ['wc3-planks','Warm wood grain','Wood','crate',[20,14,87,22]],
  ['wc3-crate-detail','Riveted planks','Wood','crate',[0,0,128,64],'detail'],
];
export const PAINT_ASSETS=Object.freeze(rows.map(([id,name,category,key,crop,application='brush'],index)=>{
  const [path,width,height,sha256]=sources[key];
  return Object.freeze({id,name,category,kind:application==='detail'?'stamp':'material',application,tags:[category.toLowerCase(),name.toLowerCase()],order:index+1,
    sourcePath:'war3.w3mod:'+path,sourceWidth:width,sourceHeight:height,crop,
    provenance:{kind:'warcraft-native',author:'Blizzard Entertainment',sourcePath:'war3.w3mod:'+path,sourceSha256:sha256,crop:{x:crop[0],y:crop[1],width:crop[2],height:crop[3]},alpha:'Source material alpha ignored for brush imagery; destination alpha is preserved independently.',reviewed:'2026-10-02'}});
}));
export const PAINT_ASSET_MANIFEST=Object.freeze({schema:PAINT_ASSET_SCHEMA,version:PAINT_ASSET_VERSION,style:'Native Warcraft III sections',logicalAssetCount:PAINT_ASSETS.length,assets:PAINT_ASSETS,pixels:'Resolved locally from configured Warcraft III data; not bundled.'});
export function paintAssetById(id){return PAINT_ASSETS.find(asset=>asset.id===id)||null;}
export function selectedPaintMaterialRaster(brush,selectedAssetId,raster){return brush?.materialId&&brush.materialId===selectedAssetId?raster:null;}

export function cropNativePaintAsset(asset,raster){
  if(raster.width!==asset.sourceWidth||raster.height!==asset.sourceHeight)throw Error('This Warcraft texture has a different layout. Open it in the WC3 library and choose its section.');
  const [left,top,width,height]=asset.crop,result=createPaintRaster(width,height);
  if(left<0||top<0||left+width>raster.width||top+height>raster.height)throw Error('The native section is outside its source image.');
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const to=(y*width+x)*4,from=((y+top)*raster.width+x+left)*4;result.data.set(raster.data.subarray(from,from+3),to);result.data[to+3]=255;}
  return result;
}
