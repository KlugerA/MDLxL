import test from 'node:test';
import assert from 'node:assert/strict';
import {validateShowcaseExport,showcaseExportPreferences} from '../app/showcase-export.js';
import {beginRecordingGroup,setRecordingSession,queueRecording,recordingQueueSnapshot,retryCatboxUpload} from '../app/preview-recording-queue.js';
test('Hive rejects long recordings or sequences, Catbox keeps duration and 30 FPS',()=>{assert.doesNotThrow(()=>validateShowcaseExport('hive',5,[{seconds:2},{seconds:3}]));for(const [length,rows] of [[5.01,[]],[5,[{seconds:6}]],[5,[{seconds:3},{seconds:3}]]])assert.throws(()=>validateShowcaseExport('hive',length,rows),/Hive.*5 seconds/);assert.doesNotThrow(()=>validateShowcaseExport('catbox',60,[{seconds:60}]));assert.deepEqual(showcaseExportPreferences({capture:{fps:10,recordingQuality:'low'}},'catbox').capture,{fps:30,recordingQuality:'high'});});
test('export queue retains multiple links, prevents duplicate uploads and ignores stale results',async()=>{
 let uploads=0,release;
 globalThis.window={desktop:{finishPreviewRecording:async()=>({width:864,height:864}),savePreviewRecording:async id=>({exportId:id,name:id+'.gif',path:'/local/'+id+'.gif',size:100}),uploadPreviewToCatbox:async id=>{uploads++;if(id==='wait')await new Promise(resolve=>{release=resolve;});return {ok:true,url:'https://files.catbox.moe/'+id+'.gif'};}}};
 const group=beginRecordingGroup('model-a');
 await queueRecording({jobId:'one',time:1000,group,upload:true});await queueRecording({jobId:'two',time:1000,group,upload:true});assert.equal(recordingQueueSnapshot().results.length,2);setRecordingSession('model-a');assert.equal(recordingQueueSnapshot().results.length,2);await retryCatboxUpload('one');assert.equal(uploads,2);
 const pending=queueRecording({jobId:'wait',time:1000,group,upload:true});while(!release)await new Promise(resolve=>setImmediate(resolve));await retryCatboxUpload('wait');assert.equal(uploads,3);beginRecordingGroup('model-a');release();await pending;assert.equal(recordingQueueSnapshot().results.length,0);
 await queueRecording({jobId:'local',time:1000,group:beginRecordingGroup('model-a'),upload:false});assert.equal(uploads,3);assert.equal(recordingQueueSnapshot().results.length,0);
 await queueRecording({jobId:'three',time:1000,group:beginRecordingGroup('model-a'),upload:true});setRecordingSession('model-b');assert.equal(recordingQueueSnapshot().results.length,0);delete globalThis.window;
});
test('upload failure preserves local result and retries do not encode or save again',async()=>{
 let saves=0,uploads=0;globalThis.window={desktop:{finishPreviewRecording:async()=>({}),savePreviewRecording:async()=>{saves++;return {exportId:'retry',path:'/local/kept.gif',name:'kept.gif'};},uploadPreviewToCatbox:async()=>++uploads===1?{ok:false,error:{message:'Offline'}}:{ok:true,url:'https://files.catbox.moe/retry.gif'}}};
 await queueRecording({jobId:'retry',time:1,group:beginRecordingGroup('retry-model'),upload:true});const row=recordingQueueSnapshot().results[0];assert.equal(row.state,'failed');assert.equal(row.path,'/local/kept.gif');assert.equal(row.error,'Offline');await retryCatboxUpload('retry');assert.equal(recordingQueueSnapshot().results[0].url,'https://files.catbox.moe/retry.gif');assert.equal(saves,1);assert.equal(uploads,2);delete globalThis.window;
});
