import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('application branding uses the supplied transparent PNG in a complete Windows icon',()=>{
  const png=readFileSync(new URL('../public/branding/MDLxL.png',import.meta.url));
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(png.readUInt32BE(16),1254);
  assert.equal(png.readUInt32BE(20),1254);

  const ico=readFileSync(new URL('../public/branding/MDLxL.ico',import.meta.url));
  assert.equal(ico.readUInt16LE(0),0);
  assert.equal(ico.readUInt16LE(2),1);
  const count=ico.readUInt16LE(4);
  assert.equal(count,7);
  const sizes=[];
  for(let index=0;index<count;index++){
    const entry=6+index*16;
    sizes.push(ico[entry]||256);
    const length=ico.readUInt32LE(entry+8), offset=ico.readUInt32LE(entry+12);
    assert.deepEqual([...ico.subarray(offset,offset+8)],[137,80,78,71,13,10,26,10]);
    assert.ok(offset+length<=ico.length);
  }
  assert.deepEqual(sizes,[16,24,32,48,64,128,256]);
});
