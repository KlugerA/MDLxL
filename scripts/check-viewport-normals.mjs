// GPU regression: run after installing Playwright, or set PLAYWRIGHT_MODULE to its package.json.
// BROWSER_CHANNEL can select an installed Chromium browser (for example msedge).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(process.env.PLAYWRIGHT_MODULE || import.meta.url);
const {chromium}=require('playwright');
// Exercise the actual owning material factory, without exporting a test-only app API.
const viewport=fs.readFileSync(path.join(root,'app/Viewport.jsx'),'utf8');
const factory=viewport.slice(viewport.indexOf('function layerMaterial('),viewport.indexOf('\nfunction clearGroup('));
assert.ok(factory.startsWith('function layerMaterial('));
const server=http.createServer((req,res)=>{
  if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const routes={
    '/':'<!doctype html><canvas></canvas>',
    '/material.js':`import * as THREE from '/three.js';\n${factory}\nexport {layerMaterial};`,
    '/three.js':fs.readFileSync(path.join(root,'node_modules/three/build/three.module.js')),
    '/three.core.js':fs.readFileSync(path.join(root,'node_modules/three/build/three.core.js')),
  };
  if(!(req.url in routes)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',req.url==='/'?'text/html':'text/javascript');res.end(routes[req.url]);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || undefined,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const results=await page.evaluate(async()=>{
    const THREE=await import('/three.js'),{layerMaterial}=await import('/material.js');
    const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:false});
    renderer.setSize(127,127);renderer.setClearColor(0x000000);
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0xffffff,Math.PI*.5));
    const light=new THREE.DirectionalLight(0xffffff,Math.PI*.5);light.position.set(0,0,3);scene.add(light);
    const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);
    const target=new THREE.WebGLRenderTarget(127,127),pixels=new Uint8Array(127*127*4),results=[];
    const texture=new THREE.DataTexture(new Uint8Array([240,180,120,255]),1,1);texture.needsUpdate=true;
    const fixtures={
      valid:[0,0,1,0,0,1,0,0,1],
      zero:[0,0,0,0,0,0,0,0,0],
      mixed:[0,0,1,0,0,0,0,0,1],
      cancelling:[0,0,1,0,0,-1,0,0,0],
      opposing:[0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1],
      'opposing-zero':[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    };
    for(const [name,normals]of Object.entries(fixtures))for(const side of [1,-1])for(const textured of [false,true]){
      const doubled=normals.length===18,positions=[-.8,-.8,0,.8,-.8,0,0,.8,0];
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(doubled?[...positions,...positions]:positions,3));
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Array(normals.length/3*2).fill(.5),2));
      geometry.setIndex(doubled?[0,1,2,5,4,3]:[0,1,2]);
      const before=Array.from(geometry.attributes.normal.array);
      const material=layerMaterial({Shading:16,FilterMode:textured?1:0});material.specular.setRGB(0,0,0);material.shininess=1;
      if(textured)material.map=texture;
      const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
      camera.position.set(0,0,side*3);camera.lookAt(0,0,0);
      renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,127,127,pixels);
      const samples=[[63,63],[63,40],[63,80]].map(([x,y])=>Array.from(pixels.slice((y*127+x)*4,(y*127+x)*4+3)));
      results.push({name,side,textured,samples,preserved:JSON.stringify(before)===JSON.stringify(Array.from(geometry.attributes.normal.array))});
      scene.remove(mesh);geometry.dispose();material.dispose();
    }
    texture.dispose();target.dispose();renderer.dispose();return results;
  });
  assert.deepEqual(errors,[]);
  for(const r of results){assert.ok(r.preserved,`${r.name}: authored buffer changed`);for(const pixel of r.samples)assert.ok(Math.min(...pixel)>10,`${r.name}, side ${r.side}, textured ${r.textured}: black fragment ${pixel}`);}
  for(const r of results.filter(r=>r.name!=='cancelling')){
    const valid=results.find(v=>v.name==='valid'&&v.side===r.side&&v.textured===r.textured);
    assert.deepEqual(r.samples,valid.samples,r.name+': face lighting must match a valid normal on this flat triangle');
  }
  console.log(JSON.stringify({passed:results.length,results},null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
