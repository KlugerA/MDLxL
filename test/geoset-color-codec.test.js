import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoDocument, openDocument} from '../src/editor-document.js';
import {sampleGeosetAnimation} from '../src/animation.js';

const vector = values => new Float32Array(values);
test('MDX GEOA colors retain authored channel order through load and save', () => {
  const doc=createDemoDocument();
  doc.apply('RGB fixture',['GeosetAnims'],model=>{
    model.GeosetAnims[0].Color={LineType:2,GlobalSeqId:null,Keys:[{Frame:0,Vector:vector([1,.25,0]),InTan:vector([.75,.5,.125]),OutTan:vector([.875,.375,.25])}]};
    model.GeosetAnims[1].Color=vector([1,.25,0]);
  });
  const bytes=Buffer.from(doc.serialize('mdx')),tag=bytes.indexOf(Buffer.from('KGAC'));
  assert(tag>0);
  // Independent byte-level assertions: do not rely only on writer/reader agreement.
  const triplet=offset=>[0,4,8].map(n=>bytes.readFloatLE(offset+n));
  assert.deepEqual(triplet(tag+20),[1,.25,0]);
  assert.deepEqual(triplet(tag+32),[.75,.5,.125]);
  assert.deepEqual(triplet(tag+44),[.875,.375,.25]);
  const reopened=openDocument(bytes,'fixture.mdx');
  assert.deepEqual([...reopened.model.GeosetAnims[0].Color.Keys[0].Vector],[1,.25,0]);
  assert.deepEqual([...reopened.model.GeosetAnims[1].Color],[1,.25,0]);
  assert.deepEqual(Buffer.from(reopened.serialize('mdx')),bytes,'unchanged file bytes are preserved');
  assert.deepEqual(sampleGeosetAnimation(reopened.model,0,0,-1).color,[1,1,1],'Unanimated uses the MDX static base');
  assert.deepEqual(sampleGeosetAnimation(reopened.model,0,0,0).color,[1,.25,0],'the selected sequence uses its RGB key');
  const mdl=Buffer.from(reopened.serialize('mdl')).toString('utf8');
  assert.match(mdl,/0:\s*\{\s*0,\s*0\.25,\s*1\s*\}/);
  assert.deepEqual([...openDocument(mdl,'fixture.mdl').model.GeosetAnims[0].Color.Keys[0].Vector],[1,.25,0]);
  reopened.apply('Edit alpha',['GeosetAnims'],m=>{m.GeosetAnims[0].Alpha=.5;});
  const changed=Buffer.from(reopened.serialize('mdx')),changedTag=changed.indexOf(Buffer.from('KGAC'));
  assert.deepEqual([0,4,8].map(n=>changed.readFloatLE(changedTag+20+n)),[1,.25,0]);
});
