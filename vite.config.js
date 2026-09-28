import { defineConfig } from 'vite';
import { build as bundleNode } from 'esbuild';

export default defineConfig({ base: './', esbuild:{jsxFactory:'localizedCreateElement',jsxInject:"import { localizedCreateElement } from '/app/localized-element.js'"}, build: {outDir:'dist', emptyOutDir:true}, server:{host:'127.0.0.1',watch:{ignored:['**/electron/**']}}, plugins:[{
  name:'optimizexl-desktop-validation',
  async generateBundle() {
    const result=await bundleNode({entryPoints:['electron/optimizexl-validation.js'],bundle:true,platform:'node',format:'cjs',target:'node22',write:false});
    this.emitFile({type:'asset',fileName:'optimizexl-validation.cjs',source:result.outputFiles[0].contents});
  },
}] });
