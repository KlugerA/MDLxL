import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {GameDataDiscovery} from '../electron/game-data.cjs';
import {CascTextures} from '../electron/casc.cjs';
import {decodeDds} from '../src/dds.js';
import {encodePaintPng} from '../src/paint-project.js';

// Read-only source audit; native files remain local ignored test inputs.
const directory=path.resolve('out/citadel-audit/sources');
await fs.mkdir(directory,{recursive:true});
const discovered=await new GameDataDiscovery().discover();
const casc=new CascTextures({cacheDirectory:path.join(directory,'cache')});
try {
  const catalog=await casc.list(discovered.cascFolders);
  const candidates=catalog.sources.flatMap(s=>s.names).filter(n=>/^war3\.w3mod:/i.test(n)&&!n.slice(11).includes(':')&&/footman|grunt|peasant|cinematic|loadingscreen|blacksmith|chainmail|leather|wood|human.*campaign/i.test(n));
  await fs.writeFile(path.join(directory,'candidates.json'),JSON.stringify({discovered,errors:catalog.errors,candidates},null,2));
  const models=['units\\human\\Footman\\Footman.mdx','units\\orc\\Grunt\\Grunt.mdx','buildings\\human\\Blacksmith\\Blacksmith.mdx'];
  const manifest=[];
  for(const name of models){
    const source='war3.w3mod:'+name,bytes=await casc.read(source,discovered.cascFolders);
    if(!bytes){manifest.push({source,missing:true});continue;}
    const file=path.join(directory,path.win32.basename(name));await fs.writeFile(file,bytes);
    manifest.push({source,file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  await fs.writeFile(path.join(directory,'models.json'),JSON.stringify(manifest,null,2));
  const sourceNames=['textures\\grunt.dds','textures\\peasant.dds','textures\\footman.dds','ui\\glues\\singleplayer\\humancampaign3d\\humancampaignfootman.dds','ui\\glues\\singleplayer\\humancampaign3d\\footman.dds','ui\\glues\\singleplayer\\humancampaign3d\\humancampaignwoodmetaltrim.dds','ui\\glues\\singleplayer\\humancampaign3d\\humancampaignloincloth.dds','ui\\glues\\singleplayer\\humancampaign3d\\crates02sides.dds','buildings\\human\\blacksmith\\newblacksmith.dds'];
  const textures=[];
  for(const name of sourceNames){
    const source='war3.w3mod:'+name,bytes=await casc.read(source,discovered.cascFolders);
    if(!bytes){textures.push({source,missing:true});continue;}
    const raster=decodeDds(bytes),file=path.join(directory,name.replaceAll('\\','_')+'.png');
    for(let i=3;i<raster.data.length;i+=4)raster.data[i]=255;
    await fs.writeFile(file,await encodePaintPng(raster));
    textures.push({source,file,width:raster.width,height:raster.height,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  await fs.writeFile(path.join(directory,'textures.json'),JSON.stringify(textures,null,2));
  console.log(JSON.stringify({candidateCount:candidates.length,models:manifest,textures},null,2));
} finally {await casc.close();}
