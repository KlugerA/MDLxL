import { defineConfig } from 'vite';
export default defineConfig({ base: './', esbuild:{jsxFactory:'localizedCreateElement',jsxInject:"import { localizedCreateElement } from '/app/localized-element.js'"}, build: {outDir:'dist', emptyOutDir:true}, server:{host:'127.0.0.1',watch:{ignored:['**/electron/**']}} });
