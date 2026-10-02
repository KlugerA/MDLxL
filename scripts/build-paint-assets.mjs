import fs from 'node:fs/promises';
import {PAINT_ASSET_MANIFEST} from '../src/paint-assets.js';
// The native collection contains source recipes only. Never synthesize pixels
// or bundle game bytes to replace an unavailable local Warcraft installation.
await fs.mkdir('public/paint-assets',{recursive:true});
await fs.writeFile('public/paint-assets/manifest.json',JSON.stringify(PAINT_ASSET_MANIFEST,null,2)+'\n');
