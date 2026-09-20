import test from 'node:test';
import assert from 'node:assert/strict';
import { combineUVGeosets, collapseUVCoordinates, foldUVCoordinates, projectUVFromView, relevantUVMaterials, splitCombinedUV, uncoupleUVVertices } from '../src/uv-tools.js';
import { compositeMaterialPixels } from '../src/uv-material-compositor.js';

const geoset = (offset = 0, material = 0) => ({ MaterialID: material,
  Vertices: new Float32Array([offset, 0, 0, offset + 1, 0, 0, offset, 1, 0, offset + 1, 1, 0]),
  Normals: new Float32Array([0,0,1, 0,0,1, 0,0,1, 0,0,1]), VertexGroup: new Uint8Array([0,0,0,0]),
  TVertices: [new Float32Array([0,0, 1,0, 0,1, 1,1])], Faces: new Uint16Array([0,1,2, 1,3,2]), Groups: [[0]],
});

test('relevant UV material menu contains only materials used by available geosets and retains every WC3 layer', () => {
  const model = { Textures: [{ ReplaceableId: 1 }, { Image: 'Textures\\Body.blp' }, { Image: 'Other.blp' }], Materials: [
    { Layers: [{ TextureID: 0, CoordId: 0, FilterMode: 0 }, { TextureID: 1, CoordId: 0, FilterMode: 2 }] },
    { Layers: [{ TextureID: 2, CoordId: 0, FilterMode: 0 }] },
  ], Geosets: [geoset(0, 0), geoset(2, 0), geoset(4, 1)], Sequences: [], GlobalSequences: [] };
  const entries = relevantUVMaterials(model, { 0: [0,1], 1: [2], 2: [] });
  assert.equal(entries.length, 1); assert.equal(entries[0].materialID, 0); assert.deepEqual(entries[0].geosetIndices, [0,1]);
  assert.deepEqual(entries[0].layers.map(layer => layer.label), ['Team Color', 'Body.blp']);
  assert.match(entries[0].label, /Team Color \+ Body\.blp/);
});

test('combined material map round-trips UVs across multiple geosets without exposing unavailable vertices', () => {
  const model = { Geosets: [geoset(0), geoset(2)] };
  const combined = combineUVGeosets(model, [0,1], { 0: [0,1,2], 1: [1,2,3] }, { 0: [1], 1: [2] });
  assert.deepEqual(combined.eligibleVertices, [0,1,2,5,6,7]); assert.deepEqual(combined.selectedVertices, [1,6]);
  const edited = new Float32Array(combined.geoset.TVertices[0]); edited[2] = .25; edited[13] = .75;
  const changes = splitCombinedUV(model, combined.refs, edited);
  assert.equal(changes.length, 2); assert.equal(changes[0].values[2], .25); assert.equal(changes[1].values[5], .75);
  assert.equal(model.Geosets[0].TVertices[0][2], 1, 'temporary map does not mutate the model');
});

test('Collapse shares the centroid and repeated Fold presses halve the selected UV span like paper', () => {
  const values = new Float32Array([0,0, 1,0, 2,0, 3,0]);
  assert.deepEqual([...collapseUVCoordinates(values, [0,3])], [1.5,0, 1,0, 2,0, 1.5,0]);
  const once = foldUVCoordinates(values, [0,1,2,3], 'right-to-left');
  assert.deepEqual([...once], [0,0, 1,0, 1,0, 0,0]);
  assert.deepEqual([...foldUVCoordinates(once, [0,1,2,3], 'right-to-left')], [0,0, 0,0, 0,0, 0,0]);
  assert.deepEqual([...foldUVCoordinates(new Float32Array([0,0, .25,0, 1,0]), [0,1,2], 'right-to-left')], [0,0, .25,0, 0,0]);
});

test('UV Uncouple duplicates repeated face corners and preserves every 3D attribute exactly', () => {
  const joined = geoset(); joined.Faces = new Uint16Array([0,1,2, 0,2,3]); joined.Tangents = new Float32Array(16).map((_, i) => i); joined.SkinWeights = new Uint8Array(32).map((_, i) => i);
  const joinedBefore = structuredClone(joined), changed = uncoupleUVVertices(joined, [0,2]);
  assert.equal(changed.added, 2);
  assert.deepEqual([...joined.Faces], [0,1,2,4,5,3]); assert.deepEqual(changed.selection, [0,2,4,5]);
  assert.deepEqual([...joined.Vertices.slice(12,15)], [...joinedBefore.Vertices.slice(0,3)]); assert.deepEqual([...joined.Normals.slice(15,18)], [...joinedBefore.Normals.slice(6,9)]);
  assert.deepEqual([...joined.Tangents.slice(16,20)], [...joinedBefore.Tangents.slice(0,4)]); assert.deepEqual([...joined.SkinWeights.slice(40,48)], [...joinedBefore.SkinWeights.slice(16,24)]);
});

test('view projection writes Warcraft top-down UV coordinates only for selected vertices', () => {
  const geo = { Vertices: new Float32Array([-1,-1,0, 1,1,0, 0,0,0]), TVertices: [new Float32Array([.4,.4, .4,.4, .8,.8])] };
  const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  assert.deepEqual([...projectUVFromView(geo, [0,1], identity, identity)], [0,1, 1,0, .800000011920929,.800000011920929]);
});

test('material compositor combines opaque team colour and alpha image layers and supports modulate 2x', () => {
  const base = new Uint8ClampedArray([255,0,0,255]), blue = new Uint8ClampedArray([0,0,255,128]);
  assert.deepEqual([...compositeMaterialPixels([{ pixels: base, filterMode: 0, alpha: 1 }, { pixels: blue, filterMode: 2, alpha: 1 }], 1, 1)], [127,0,128,255]);
  assert.deepEqual([...compositeMaterialPixels([{ pixels: new Uint8ClampedArray([64,64,64,255]), filterMode: 0, alpha: 1 }, { pixels: new Uint8ClampedArray([255,128,64,255]), filterMode: 6, alpha: 1 }], 1, 1)], [128,64,32,255]);
});
