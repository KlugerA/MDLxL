// Original synthetic fixtures; no game assets are redistributed.
// node test/save-compatibility-fixtures.mjs [output directory]
import fs from 'node:fs';
import path from 'node:path';
import { createStarterDocument } from '../src/starter-model.js';
import { createNode } from '../src/editor-document.js';
const root = path.resolve(process.argv[2] || 'out/save-compatibility-synthetic');
for (const folder of ['models', 'evidence']) fs.mkdirSync(path.join(root, folder), { recursive: true });
const f = (...values) => Float32Array.from(values);
const track = values => ({ LineType: 3, GlobalSeqId: null, Keys: [0, 1000].map(Frame => ({ Frame, Vector: f(...values), InTan: f(...values), OutTan: f(...values) })) });
const cases = [];
for (const version of [800, 1000]) {
  const doc = createStarterDocument(version);
  doc.apply('All-feature fixture', [], model => {
    model.Sequences = [{ Name: 'Stand', Interval: Uint32Array.of(0, 1000), NonLooping: false, MoveSpeed: 0, Rarity: 0, MinimumExtent: f(-50,-50,-50), MaximumExtent: f(50,50,50), BoundsRadius: 87 }];
    model.GlobalSequences = [1000];
    model.TextureAnims = [{ Translation: track([.1,.2,0]), Rotation: track([0,0,0,1]), Scaling: track([1,1,1]) }];
    model.Materials[0].Layers[0].TVertexAnimId = 0;
    model.Materials[0].Layers[0].Alpha = track([.75]);
    model.GeosetAnims = [{ GeosetId: 0, Flags: 2, Alpha: track([.8]), Color: track([.2,.4,.6]) }];
    const types = ['Helper','EventObject','ParticleEmitter2','Attachment','Light','RibbonEmitter','CollisionShape','ParticleEmitter','Bone'];
    if (version >= 900) types.push('ParticleEmitterPopcorn');
    for (const type of types) {
      const node = createNode(model, type); node.Name = 'Audit ' + type; node.Parent = model.Bones[0].ObjectId;
      node.PivotPoint.set([node.ObjectId, node.ObjectId * 2, node.ObjectId * 3]);
      node.Translation = track([1,2,3]); node.Rotation = track([0,0,0,1]); node.Scaling = track([1,1,1]);
      if (type === 'EventObject') { node.Name = 'SNDaDFOO'; node.EventTrack = Int32Array.of(100,900); node.GlobalSeqId = 0; }
      if (type === 'Attachment') node.Path = 'Objects\\AuditAttachment.mdx';
      if (type === 'ParticleEmitter') { node.Path = 'Objects\\AuditParticle.mdx'; node.EmissionRate = track([12]); node.Gravity = track([2]); }
      if (type === 'ParticleEmitter2') { node.Speed = track([14]); node.Width = track([5]); node.EmissionRate = track([12]); node.Visibility = track([1]); node.Rows = 2; node.Columns = 3; node.FrameFlags = 3; node.TailLength = .7; node.LifeSpanUVAnim = Uint32Array.of(0,3,2); }
      if (type === 'RibbonEmitter') { node.Color = track([.25,.5,.75]); node.HeightAbove = track([7]); node.Alpha = track([.65]); node.Visibility = track([1]); }
      if (type === 'Light') { node.Color = track([.2,.4,.6]); node.AmbColor = track([.3,.5,.7]); node.Intensity = track([.9]); node.AttenuationStart = track([5]); node.AttenuationEnd = track([200]); }
      if (type === 'ParticleEmitterPopcorn') { node.Path = 'Effects\\Audit.pkfx'; node.AnimVisibilityGuide = 'Always'; node.Color = f(.2,.4,.6); }
    }
    const bone = model.Bones.at(-1); model.Geosets[0].Groups = [[bone.ObjectId]];
    model.Cameras = [{ Name: 'Portrait', Position: f(100,0,50), TargetPosition: f(0,0,20), FieldOfView: 1, NearClip: 1, FarClip: 1000, Translation: track([1,2,3]), Rotation: track([.1]), TargetTranslation: track([4,5,6]) }];
    if (version >= 900) {
      const geoset = model.Geosets[0];
      geoset.SkinWeights = Uint8Array.from(Array.from({length:geoset.Vertices.length/3},()=>[bone.ObjectId,0,0,0,255,0,0,0]).flat());
      geoset.Tangents = Float32Array.from(Array.from({length:geoset.Vertices.length/3},()=>[1,0,0,1]).flat());
      model.BindPoses = [{ Matrices: [...model.Nodes.map(node => f(1,0,0,0,1,0,0,0,1,node.ObjectId,2,3)), f(1,0,0,0,1,0,0,0,1,70,80,90)] }];
    }
  });
  for (const round of ['first', 'after-edit']) {
    const id = `synthetic-${version}-${round}`, files = [];
    if (round === 'after-edit') doc.apply('Edit after saved ID remapping', [], model => {
      model.Helpers[0].Name += ' edited'; model.PivotPoints[model.Helpers[0].ObjectId][0] += 11; model.Materials[0].PriorityPlane = 4;
      model.ParticleEmitters2[0].Width = 17; model.ParticleEmitters2[0].Length = track([23]);
      if (model.ParticleEmitterPopcorns.length) model.ParticleEmitterPopcorns[0].Color = track([.3,.6,.9]);
    });
    fs.writeFileSync(path.join(root, 'evidence', id + '-expected.json'), JSON.stringify({model: doc.model}));
    for (const format of ['mdx', 'mdl']) {
      const file = path.join(root, 'models', id + '.' + format), bytes = doc.serialize(format);
      fs.writeFileSync(file, bytes); doc.markSaved(bytes, file); files.push(file);
    }
    cases.push({ id, files });
  }
}
fs.writeFileSync(path.join(root, 'cases.json'), JSON.stringify({ cases }, null, 2));
console.log(`Saved ${cases.length * 2} synthetic files to ${root}`);
