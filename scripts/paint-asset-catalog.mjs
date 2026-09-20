import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PAINT_ASSET_MANIFEST } from '../src/paint-assets.js';

const args=process.argv.slice(2),value=name=>{const index=args.indexOf(name);if(index<0||!args[index+1])throw Error(`${name} requires a path.`);return path.resolve(args[index+1]);};
const output=value('--out'),assetRoot=args.includes('--final')?value('--assets'):null;
const result=structuredClone(PAINT_ASSET_MANIFEST);
if(assetRoot){
  for(const asset of result.assets){
    const files=[...Object.values(asset.files||{}),...Object.values(asset.valueFiles||{})];asset.sha256={};
    for(const relative of files){const file=path.join(assetRoot,relative.replace(/^\.\/paint-assets[\\/]/,''));const bytes=await fs.readFile(file);asset.sha256[relative]=createHash('sha256').update(bytes).digest('hex');}
  }
  result.generatedAt=new Date().toISOString();result.notes=['Metal entries are hand-painted albedo, not PBR metalness.','MakeHuman body assets and Queen Neferess are intentionally excluded.','Source downloads are not redistributed; the eight derived outputs retain their CC0 page and direct-download provenance.'];
}
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');
