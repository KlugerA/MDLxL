import { createStarterDocument } from '../src/starter-model.js';

/** Deterministic geometry; no external knight assets or textures are required. */
export function renderFixture(kind = 'triangle') {
  const model = createStarterDocument().model;
  model.Textures[0] = { Image: '', ReplaceableId: 1, Flags: 0 };
  if (kind === 'checker') model.Textures[0] = { Image: 'checker.png', ReplaceableId: 0, Flags: 0 };
  if (kind !== 'rig') {
    const geo = model.Geosets[0];
    geo.Vertices = new Float32Array([-32,-32,0, 32,-32,0, 0,32,0]);
    geo.Normals = new Float32Array([0,0,1, 0,0,1, 0,0,1]);
    geo.Faces = new Uint16Array([0,1,2]);
    geo.TVertices = [new Float32Array([0,0,1,0,.5,1])]; geo.VertexGroup = new Uint8Array(3);
    if (kind === 'opposing') {
      geo.Vertices = new Float32Array([...geo.Vertices, ...geo.Vertices]);
      geo.Normals = new Float32Array([...geo.Normals, 0,0,-1, 0,0,-1, 0,0,-1]);
      geo.Faces = new Uint16Array([0,1,2,5,4,3]);
      geo.TVertices = [new Float32Array([...geo.TVertices[0],...geo.TVertices[0]])]; geo.VertexGroup = new Uint8Array(6);
    }
  }
  if (kind === 'selection') {
    const copy = structuredClone(model.Geosets[0]);
    copy.Vertices = new Float32Array(copy.Vertices.map((v,i) => i%3 === 2 ? v-10 : v));
    model.Geosets.push(copy);
  }
  if (kind === 'rig') {
    const make = (ObjectId, Name, PivotPoint, Parent = 0) => ({ ObjectId, Name, PivotPoint: new Float32Array(PivotPoint), Parent, Flags: 0 });
    model.Bones.push(make(1,'External bone',[50,0,20]), make(2,'Internal bone',[0,0,0]));
    model.Helpers = [make(3,'Helper',[-50,0,20])];
    model.Attachments = [make(4,'Attachment',[0,50,20])];
    model.EventObjects = [make(5,'Event',[0,-50,20])];
    // The emitter remains a marker fixture; particle simulation is disabled.
    model.ParticleEmitters = [make(6,'Emitter',[50,50,20])];
    model.Sequences = [{ Name:'Moving', Interval:new Uint32Array([0,1000]) }];
    model.Bones[0].Translation = { LineType:1, Keys:[{Frame:0,Vector:new Float32Array([0,0,0])},{Frame:1000,Vector:new Float32Array([0,0,50])}] };
  }
  model.PivotPoints = [];
  for (const collection of ['Bones','Helpers','Attachments','EventObjects','ParticleEmitters']) for (const node of model[collection] || []) model.PivotPoints[node.ObjectId] = node.PivotPoint || new Float32Array(3);
  model.Nodes = [];
  return model;
}
