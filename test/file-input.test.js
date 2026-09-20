import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { File } from 'node:buffer';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

// Isolate the actual pure export from JSX; tests execute the application reader,
// not a second implementation, without mounting its WebGL/React components.
const source=await readFile(new URL('../app/App.jsx',import.meta.url),'utf8');
const reader=source.match(/export async function readInputBytes\(file\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(reader,'App must expose its binary file reader for regression coverage.');
const {readInputBytes}=await import(`data:text/javascript,${encodeURIComponent(reader)}`);

test('browser File with a truthy bytes() method opens the complete editable model',async()=>{
  const original=createDemoDocument().serialize('mdx');
  const file=new File([original],'Browser-upload.mdx');
  Object.defineProperty(file,'bytes',{value:async()=>{throw new Error('The bytes method must never be treated as file data.');}});
  const bytes=await readInputBytes(file);
  assert.ok(bytes instanceof Uint8Array);assert.deepEqual([...bytes],[...original]);
  const doc=openDocument(bytes,file.name);
  assert.equal(doc.readOnly,false);assert.ok(doc.model.Geosets.length>0);assert.ok(doc.model.Sequences.length>0);
});

test('browser texture File and native IPC views retain exact byte boundaries',async()=>{
  const pngPrefix=new Uint8Array([137,80,78,71,13,10,26,10]);
  const file=new File([pngPrefix],'Texture.png');
  Object.defineProperty(file,'bytes',{value:async()=>pngPrefix});
  assert.deepEqual(await readInputBytes(file),pngPrefix);
  const storage=new Uint8Array([99,1,2,3,88]);
  assert.deepEqual(await readInputBytes({bytes:storage.subarray(1,4)}),new Uint8Array([1,2,3]));
  assert.deepEqual(await readInputBytes({bytes:new DataView(storage.buffer,1,3)}),new Uint8Array([1,2,3]));
  assert.deepEqual(await readInputBytes({bytes:pngPrefix.buffer}),pngPrefix);
});

test('missing, functional and otherwise invalid native byte payloads fail explicitly',async()=>{
  for(const file of [{},{bytes:()=>new Uint8Array([1])},{bytes:'MDLX'},{bytes:[1,2,3]},{arrayBuffer:async()=>undefined}])await assert.rejects(()=>readInputBytes(file),/readable binary data/);
});
