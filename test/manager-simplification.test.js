import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, createNode, openDocument } from '../src/editor-document.js';
import { setAnimationKey, sampleAnimationProperty } from '../src/animation-tracks.js';
import { classicTimelineTargets, classicTimelineDomain } from '../src/classic-keyframes.js';
import { clearTimelineKeys, timelineDomain } from '../src/keyframe-timeline.js';
import { eventCatalog, assignEventData, setEventFrame, resolveEventSound } from '../app/node-event-data.js';

test('native sound lookup retains identity across FLAC table paths and installed OGG files', async () => {
 const file='war3.w3mod:Units/Creeps/Spider/SpiderDeath1.flac', ogg=file.replace('.flac','.ogg');
 const bytes=new Uint8Array([1,2,3]); let request;
 const sound=await resolveEventSound(async payload=>{request=payload;return [{name:file,sourceName:ogg,bytes}];},file,'model.mdx');
 assert.deepEqual(request,{names:[file],path:'model.mdx'});
 assert.equal(sound.mime,'audio/ogg');assert.equal(sound.bytes,bytes);
 const exact=await resolveEventSound(async()=>[{name:ogg,bytes},{name:file,bytes}],file,'model.mdx');
 assert.equal(exact.mime,'audio/flac');
 await assert.rejects(resolveEventSound(async()=>[],file,'model.mdx'),/Sound not found/);
 const custom='Sounds\\MyCustom.flac';
 await assert.rejects(resolveEventSound(async payload=>{assert.deepEqual(payload.names,[custom]);return [];},custom,'model.mdx'),/Sound not found/);
});

test('sound catalog uses native IDs and authored file mappings without offering unresolved lookups', () => {
 const slk=(name,rows)=>({name,bytes:new TextEncoder().encode(rows.flatMap((row,y)=>row.map((value,x)=>`C;X${x+1};Y${y+1};K"${value}"`)).join('\n'))});
 const data=eventCatalog([
  slk('UI\\SoundInfo\\AnimLookups.slk',[['AnimSoundEvent','SoundLabel'],['DPES','PeasantDeath'],['DSPV','SpiritOfVengeanceDeath']]),
  slk('UI\\SoundInfo\\AnimSounds.slk',[['SoundName','FileNames','DirectoryBase'],['PeasantDeath','PeasantDeath.wav','Units\\Human\\Peasant']]),
  slk('war3.w3mod:UI\\SoundInfo\\AnimSounds.slk',[['SoundName','AnimationEventCode','FileNames'],['PeasantDeath','DPES','PeasantDeath1']]),
  slk('war3.w3mod:UI\\SoundInfo\\DialogueHumanBase.slk',[['DialogueLabel','Filepath'],['PeasantDeath1','Units/Human/Peasant/PeasantDeath.ogg']]),
 ]);
 assert.deepEqual(data.SND.find(n=>n.id==='DPES').files,['war3.w3mod:Units/Human/Peasant/PeasantDeath.ogg']);
 assert.equal(data.SND.some(n=>n.id==='DSPV'),false);
});

test('node visibility uses ordinary held keys, preserving other sequences, channels and undo/save', () => {
 const doc=createDemoDocument(), m=doc.model, node=createNode(m,'Attachment');
 const [start,end]=m.Sequences[0].Interval, middle=Math.floor((start+end)/2);
 const target={kind:'node',id:node.ObjectId,property:'Visibility'};
 const other=structuredClone(m.GeosetAnims);
 doc.apply('Visibility',['Nodes'],()=>setAnimationKey(m,[target],start,0,0));
 assert.equal(sampleAnimationProperty(m,target,middle,0),0);
 doc.apply('Visibility',['Nodes'],()=>setAnimationKey(m,[target],middle,1,0));
 assert.equal(sampleAnimationProperty(m,target,middle-1,0),0);
 assert.equal(sampleAnimationProperty(m,target,end,0),1);
 assert.equal(node.Visibility.LineType,0); assert.deepEqual(m.GeosetAnims,other);
 doc.undo(); assert.equal(sampleAnimationProperty(doc.model,target,end,0),0); doc.redo();
 for(const format of ['mdl','mdx'])assert.equal(sampleAnimationProperty(openDocument(doc.serialize(format),'test.'+format).model,target,end,0),1);
});
test('material visibility is explicit and never joins Movement or normal geoset targets', () => {
 const m=createDemoDocument().model, target={kind:'material',id:0,layer:0,property:'Alpha'}, frame=m.Sequences[0].Interval[0];
 setAnimationKey(m,[target],frame,0,0);
 for(const activeController of ['move','animations'])assert.ok(classicTimelineTargets(m,{activeController,highlightKeyframes:false,domain:classicTimelineDomain(m,0)}).every(t=>t.kind!=='material'));
 const scoped=classicTimelineTargets(m,{activeController:'materialVisibility:0:0',domain:classicTimelineDomain(m,0)});
 assert.equal(scoped.length,1); assert.equal(scoped[0].kind,'material');
 const geosets=structuredClone(m.GeosetAnims);
 clearTimelineKeys(m,scoped,[{trackId:scoped[0].trackId,frame}],timelineDomain(m,0));
 assert.deepEqual(m.GeosetAnims,geosets); assert.equal(m.Materials[0].Layers[0].Alpha.Keys.length,0);
});
test('event assignment retains parent and transforms; event times roundtrip in both codecs', () => {
 const doc=createDemoDocument(); let n;
 doc.apply('Create event',['Nodes','PivotPoints'],()=>{n=createNode(doc.model,'EventObject');});
 const original=structuredClone(n);
 doc.apply('Sound event',['Nodes'],()=>{assignEventData(n,'SND','DSPV');setEventFrame(n,0,true);setEventFrame(n,400,true);setEventFrame(n,400,true);});
 assert.equal(n.Name.slice(0,3),'SND'); assert.equal(n.Name.slice(4),'DSPV'); assert.deepEqual([...n.EventTrack],[0,400]);
 assert.deepEqual(n.PivotPoint,original.PivotPoint); assert.equal(n.Parent,original.Parent);
 for(const format of ['mdl','mdx'])assert.deepEqual([...openDocument(doc.serialize(format),'event.'+format).model.Nodes[n.ObjectId].EventTrack],[0,400]);
 doc.undo(); assert.equal(doc.model.Nodes[n.ObjectId].Name,original.Name);
});
