import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import zlib from 'node:zlib';import {createRequire} from 'node:module';
import {createDemoDocument,EditorDocument} from '../src/editor-document.js';
import {chooseGeosets,invertGeosets,allGeosets} from '../src/classic-selection.js';
import {transformVertices} from '../src/editor-commands.js';
import v8 from 'node:v8';
const require=createRequire(import.meta.url),{RecoveryStore}=require('../electron/recovery.cjs'),{Mpq,hash}=require('../electron/mpq.cjs');
test('Shift checks and clears whole geoset ranges; Ctrl toggles independently',()=>{let s=chooseGeosets(new Set(),1,{ctrl:true,count:8});s=chooseGeosets(s,5,{shift:true,anchor:1,count:8,checked:true});assert.deepEqual([...s],[1,2,3,4,5]);s=chooseGeosets(s,4,{shift:true,anchor:2,count:8,checked:false});assert.deepEqual([...s],[1,5]);s=chooseGeosets(s,7,{ctrl:true,count:8});assert.deepEqual([...s],[1,5,7]);assert.equal(invertGeosets(s,8).size,5);assert.equal(allGeosets(8).size,8);});
test('separate geosets rotate about one shared pivot',()=>{const a={Vertices:new Float32Array([1,0,0]),Normals:new Float32Array([1,0,0]),Faces:new Uint16Array()},b={Vertices:new Float32Array([-1,0,0]),Normals:new Float32Array([-1,0,0]),Faces:new Uint16Array()};for(const g of[a,b])transformVertices(g,[0],[0,0,0],[1,1,1],[0,0,90],[0,0,0]);assert.ok(Math.abs(a.Vertices[0])<1e-6);assert.equal(a.Vertices[1],1);assert.equal(b.Vertices[1],-1);});
test('disk recovery keeps typed model data and both history directions; stale writes cannot replace new',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mdlvis-recovery-test-'));try{const store=new RecoveryStore(dir),d=createDemoDocument();for(let i=0;i<30;i++)d.apply('Move',['Geosets'],()=>d.model.Geosets[0].Vertices[0]++);d.undo();const state=d.captureRecoveryState();await Promise.all([store.write({id:'session',version:2,path:null,state}),store.write({id:'session',version:1,path:null,state:{name:'STALE'}})]);await store.flush();const got=await store.read('session'),restored=EditorDocument.restoreRecoveryState(got.state);assert.equal(got.version,2);assert.equal(restored.historyStats.undoSteps,29);assert.equal(restored.historyStats.redoSteps,1);const x=restored.model.Geosets[0].Vertices[0];restored.redo();assert.equal(restored.model.Geosets[0].Vertices[0],x+1);assert.equal((await store.list())[0].name,d.name);await assert.rejects(store.read('../bad'),/identifier/);await fs.writeFile(path.join(dir,'bad.recovery'),Buffer.from('corrupt'));await assert.rejects(store.read('bad'));}finally{await fs.rm(dir,{recursive:true,force:true});}});
const table=new Uint32Array(1280);let seed=0x100001;for(let i=0;i<256;i++)for(let j=i;j<1280;j+=256){seed=(seed*125+3)%0x2aaaab;const a=(seed&65535)<<16;seed=(seed*125+3)%0x2aaaab;table[j]=(a|(seed&65535))>>>0;}
function encrypt(input,key){const out=Buffer.from(input);let b=0xeeeeeeee;for(let p=0;p+4<=out.length;p+=4){b=(b+table[0x400+(key&255)])>>>0;const v=input.readUInt32LE(p);out.writeUInt32LE((v^(key+b))>>>0,p);key=(((~key<<21)+0x11111111)|(key>>>11))>>>0;b=(v+b+(b<<5)+3)>>>0;}return out;}
test('native64 MPQ reader decrypts indexes, inflates a fixture, validates bounds',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mdlvis-mpq-test-'));let archive;try{const name='Textures\\Fixture.blp',plain=Buffer.from('BLP1'+'synthetic texture '.repeat(200)),payload=Buffer.concat([Buffer.from([2]),zlib.deflateSync(plain)]),header=Buffer.alloc(32),hashes=Buffer.alloc(64,255),blocks=Buffer.alloc(16);header.write('MPQ\x1a','binary');header.writeUInt32LE(32,4);header.writeUInt32LE(112+payload.length,8);header.writeUInt16LE(3,14);header.writeUInt32LE(32,16);header.writeUInt32LE(96,20);header.writeUInt32LE(4,24);header.writeUInt32LE(1,28);const h=(hash(name,0)%4)*16;hashes.writeUInt32LE(hash(name,1),h);hashes.writeUInt32LE(hash(name,2),h+4);hashes.writeUInt32LE(0,h+8);hashes.writeUInt32LE(0,h+12);blocks.writeUInt32LE(112,0);blocks.writeUInt32LE(payload.length,4);blocks.writeUInt32LE(plain.length,8);blocks.writeUInt32LE(0x81000200,12);const file=path.join(dir,'fixture.mpq');await fs.writeFile(file,Buffer.concat([header,encrypt(hashes,hash('(hash table)',3)),encrypt(blocks,hash('(block table)',3)),payload]));archive=await Mpq.open(file);assert.deepEqual(await archive.read(name.toLowerCase()),plain);assert.equal(await archive.read('missing.blp'),null);await assert.rejects(archive.readAt(archive.size-1,32),/bounds/);}finally{await archive?.close();await fs.rm(dir,{recursive:true,force:true});}});

async function scratch(t, prefix) {
  const root = path.resolve(os.tmpdir()), dir = await fs.mkdtemp(path.join(root, prefix));
  t.after(async () => {
    const resolved = path.resolve(dir);
    if (!resolved.toLowerCase().startsWith(root.toLowerCase() + path.sep) || !path.basename(resolved).startsWith(prefix)) throw Error('Unexpected test cleanup location.');
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return dir;
}

test('recovery lists the current embedded dirty metadata after restart despite stale or broken sidecars', async (t) => {
  const dir = await scratch(t, 'mdlvis-recovery-atomic-'), store = new RecoveryStore(dir);
  await store.write({ id: 'model', version: 1, dirty: false, path: 'C:\\models\\copied.mdx', state: { name: 'Saved copy' } });
  await store.write({ id: 'model', version: 2, dirty: true, path: 'C:\\models\\copied.mdx', state: { name: 'Edited copy', vector: new Float32Array([1, 2, 3]) } });
  const data = await fs.readFile(store.file('model'));
  assert.equal(data.toString('ascii', 0, 4), 'MDLR');
  const metadata = JSON.parse(data.subarray(8, 8 + data.readUInt32LE(4)).toString('utf8'));
  assert.equal(metadata.version, 2); assert.equal(metadata.dirty, true);
  assert.equal(metadata.bytes, data.length - 8 - data.readUInt32LE(4));
  assert.deepEqual(await fs.readdir(dir), ['model.recovery']);
  // Leftovers from the old two-file format must never hide a newer dirty model.
  await fs.writeFile(path.join(dir, 'model.recovery.json'), JSON.stringify({ id: 'model', version: 1, dirty: false, name: 'STALE' }));
  await fs.writeFile(path.join(dir, 'broken.recovery.json'), '{partial');
  const restarted = new RecoveryStore(dir), items = await restarted.list(), payload = await restarted.read('model');
  assert.equal(items.length, 1); assert.equal(items[0].version, 2); assert.equal(items[0].dirty, true);
  assert.equal(items[0].name, payload.state.name); assert.equal(items[0].path, payload.path);
  assert.deepEqual(payload.state.vector, new Float32Array([1, 2, 3]));
});

test('an interrupted temporary recovery write preserves the last committed snapshot and can be retried', async (t) => {
  const dir = await scratch(t, 'mdlvis-recovery-interrupted-'), store = new RecoveryStore(dir);
  const original = { id: 'model', version: 1, dirty: true, state: { name: 'Committed' } };
  await store.write(original);
  const committed = await fs.readFile(store.file('model'));
  await fs.writeFile(store.file('model') + '.tmp', Buffer.from('MDLR\x03'));
  const restarted = new RecoveryStore(dir);
  assert.equal((await restarted.list()).length, 1);
  assert.equal((await restarted.read('model')).state.name, 'Committed');
  assert.deepEqual(await fs.readFile(store.file('model')), committed);
  await restarted.write({ ...original, version: 2, state: { name: 'Next successful edit' } });
  assert.equal((await restarted.read('model')).version, 2);
  assert.deepEqual(await fs.readdir(dir), ['model.recovery']);
});

test('recovery can recover payload metadata from damaged JSON and rejects a truncated compressed payload', async (t) => {
  const dir = await scratch(t, 'mdlvis-recovery-damage-'), store = new RecoveryStore(dir);
  await store.write({ id: 'recoverable', version: 7, dirty: true, state: { name: 'Recoverable model', values: new Uint16Array([11, 22]) } });
  const damaged = await fs.readFile(store.file('recoverable'));
  damaged[8] = 0; // Metadata is corrupt but its length and the gzip payload survive.
  await fs.writeFile(store.file('recoverable'), damaged);
  const items = await store.list();
  assert.equal(items.length, 1); assert.equal(items[0].name, 'Recoverable model');
  assert.equal(items[0].version, 7); assert.equal(items[0].dirty, true);
  assert.deepEqual((await store.read('recoverable')).state.values, new Uint16Array([11, 22]));
  await fs.writeFile(store.file('recoverable'), damaged.subarray(0, damaged.length - 9));
  await assert.rejects(store.read('recoverable'));
  assert.deepEqual(await store.list(), []);
});

test('legacy gzip recovery without a sidecar remains discoverable and serialization failures do not poison the queue', async (t) => {
  const dir = await scratch(t, 'mdlvis-recovery-legacy-'), store = new RecoveryStore(dir);
  const legacy = { id: 'legacy', version: 3, dirty: true, date: '2026-09-09T00:00:00.000Z', state: { name: 'Legacy model' } };
  await fs.writeFile(store.file('legacy'), zlib.gzipSync(v8.serialize(legacy)));
  assert.equal((await store.list())[0].name, legacy.state.name);
  assert.deepEqual(await store.read('legacy'), legacy);
  await assert.rejects(store.write({ ...legacy, version: 4, state: { name: 'Invalid', cannotSerialize() {} } }));
  assert.equal((await store.read('legacy')).version, 3);
  await store.write({ ...legacy, version: 5, dirty: false, state: { name: 'Saved successfully' } });
  assert.equal((await store.read('legacy')).version, 5);
  assert.equal((await store.list())[0].dirty, false);
});

function mpqFixture(name, payload, { size = payload.length, flags = 0x81000000, block = 0 } = {}) {
  const header = Buffer.alloc(32), hashes = Buffer.alloc(64, 255), blocks = Buffer.alloc(16);
  header.write('MPQ\x1a', 'binary'); header.writeUInt32LE(32, 4); header.writeUInt32LE(112 + payload.length, 8);
  header.writeUInt16LE(3, 14); header.writeUInt32LE(32, 16); header.writeUInt32LE(96, 20); header.writeUInt32LE(4, 24); header.writeUInt32LE(1, 28);
  const h = (hash(name, 0) % 4) * 16;
  hashes.writeUInt32LE(hash(name, 1), h); hashes.writeUInt32LE(hash(name, 2), h + 4); hashes.writeUInt32LE(0, h + 8); hashes.writeUInt32LE(block, h + 12);
  blocks.writeUInt32LE(112, 0); blocks.writeUInt32LE(payload.length, 4); blocks.writeUInt32LE(size, 8); blocks.writeUInt32LE(flags >>> 0, 12);
  return Buffer.concat([header, encrypt(hashes, hash('(hash table)', 3)), encrypt(blocks, hash('(block table)', 3)), payload]);
}

test('raw MPQ textures reject truncated or excess bytes in all encrypted and single-unit combinations', async (t) => {
  const dir = await scratch(t, 'mdlvis-mpq-size-'), name = 'Textures\\Sized.blp', plain = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
  for (const flags of [0x80000000, 0x81000000, 0x80010000, 0x81010000]) {
    const payload = flags & 0x10000 ? encrypt(plain, hash('Sized.blp', 3)) : plain;
    for (const size of [plain.length - 1, plain.length + 1]) {
      const file = path.join(dir, `invalid-${flags}-${size}.mpq`);
      await fs.writeFile(file, mpqFixture(name, payload, { flags, size }));
      const archive = await Mpq.open(file);
      try { await assert.rejects(archive.read(name), /size mismatch/); } finally { await archive.close(); }
    }
    const file = path.join(dir, `valid-${flags}.mpq`);
    await fs.writeFile(file, mpqFixture(name, payload, { flags }));
    const archive = await Mpq.open(file);
    try { assert.deepEqual(await archive.read(name), plain); } finally { await archive.close(); }
  }
});

test('MPQ detects a file truncated after opening instead of padding the read result', async (t) => {
  const dir = await scratch(t, 'mdlvis-mpq-truncated-'), name = 'Textures\\Truncated.blp', file = path.join(dir, 'truncated.mpq');
  const bytes = mpqFixture(name, Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));
  await fs.writeFile(file, bytes);
  const archive = await Mpq.open(file);
  try {
    await fs.truncate(file, bytes.length - 3);
    await assert.rejects(archive.read(name), /Truncated MPQ archive/);
  } finally { await archive.close(); }
});

test('MPQ rejects hash references outside its block table and sector offsets into the table', async (t) => {
  const dir = await scratch(t, 'mdlvis-mpq-index-'), name = 'Textures\\Bounds.blp';
  const malformedSector = Buffer.alloc(12); malformedSector.writeUInt32LE(4, 0); malformedSector.writeUInt32LE(12, 4);
  for (const [label, bytes, message] of [
    ['hash', mpqFixture(name, Buffer.alloc(4), { block: 1 }), /outside the block table/],
    ['sector', mpqFixture(name, malformedSector, { flags: 0x80000200, size: 16 }), /sector offset/],
  ]) {
    const file = path.join(dir, label + '.mpq'); await fs.writeFile(file, bytes);
    const archive = await Mpq.open(file);
    try { await assert.rejects(archive.read(name), message); } finally { await archive.close(); }
  }
});

test('disk recovery compacts V8 pooled typed views before IPC while retaining node and pivot aliases', async (t) => {
  const dir = await scratch(t, 'mdlvis-recovery-compact-'), store = new RecoveryStore(dir);
  const shared = new ArrayBuffer(65536), point = new Float32Array(shared, 1024, 3);
  point.set([1.25, -2.5, 3.75]);
  const node = { ObjectId: 5, PivotPoint: point }, nodes = new Array(6); nodes[5] = node;
  const bytes = new Uint8Array(shared, 2000, 5); bytes.set([11, 22, 33, 44, 55]);
  const dataView = new DataView(shared, 3000, 6); dataView.setUint32(0, 0x12345678);
  const pooledBuffer = Buffer.from([90, 80, 70]);
  const state = { name: 'Many small animation keys', Nodes: nodes, Bones: [node], PivotPoints: [point],
    keys: Array.from({ length: 2000 }, (_, i) => new Float32Array([i, i + 0.25, -i])),
    bytes, dataView, pooledBuffer, aliases: [point, bytes, dataView, pooledBuffer] };
  await store.write({ id: 'pooled', version: 1, dirty: true, state });
  const actual = (await store.read('pooled')).state;
  assert.deepEqual(actual, state);
  assert.equal(actual.Nodes[5], actual.Bones[0]); assert.equal(actual.Nodes[5].PivotPoint, actual.PivotPoints[0]);
  assert.equal(0 in actual.Nodes, false); // Sparse object IDs must stay sparse.
  assert.equal(actual.aliases[0], actual.PivotPoints[0]); assert.equal(actual.aliases[1], actual.bytes);
  assert.equal(actual.aliases[2], actual.dataView); assert.equal(actual.aliases[3], actual.pooledBuffer);
  assert.ok(actual.PivotPoints[0] instanceof Float32Array); assert.ok(actual.dataView instanceof DataView); assert.ok(Buffer.isBuffer(actual.pooledBuffer));
  const visited = new Set(); let viewCount = 0, payloadBytes = 0, backingBytes = 0;
  function inspect(value) {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (ArrayBuffer.isView(value)) {
      viewCount++; payloadBytes += value.byteLength; backingBytes += value.buffer.byteLength;
      assert.equal(value.byteOffset, 0); assert.equal(value.buffer.byteLength, value.byteLength);
    } else for (const child of Object.values(value)) inspect(child);
  }
  inspect(actual); assert.equal(viewCount, 2004); assert.equal(backingBytes, payloadBytes);
  actual.PivotPoints[0][0] = 99; assert.equal(actual.Nodes[5].PivotPoint[0], 99); assert.equal(point[0], 1.25);
  await store.write({ id: 'pooled', version: 2, dirty: true, state: actual });
  const reopened = (await store.read('pooled')).state;
  assert.deepEqual(reopened, actual); assert.equal(reopened.Nodes[5], reopened.Bones[0]);
  assert.equal(reopened.PivotPoints[0].buffer.byteLength, 12);
});
