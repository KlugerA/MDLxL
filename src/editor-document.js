import { versionConversionIssues, normalizeVersionFields } from './model-version.js';
import { Buffer } from 'buffer';
import { parseMDL, generateMDL } from 'war3-model';
import { parseCompatibleMdx as parseMDX, generateCompatibleMdx as generateMDX } from './mdx-compatibility.js';
import { prepareCompatibleMdl, finishCompatibleMdl, readMdlPivotPoints } from './mdl-compatibility.js';
import { assertModelEquivalent } from './save-equivalence.js';
import { preserveMdxRecords, preserveMdlRecords } from './record-preservation.js';
import { parseMdx, SUPPORTED_FORMAT_VERSIONS } from './mdx-container.js';
import { parseMdl, mdlStringEnd } from './mdl-lossless.js';
import { HistoryStore, createChanges, applyChanges } from './history-store.js';
import { prepareMdlEventObject, restoreMdxEventGlobalSequences, writeMdlEventGlobalSequences, writeMdxEventGlobalSequences } from './event-object-codec.js';
import { prepareMdlPopcornColors, restoreMdlPopcornRotations } from './popcorn-rotation-codec.js';
import { writeMdlUVSets } from './uv-coordinate-codec.js';
import { convertMdxGeosetColorTracks } from './geoset-color-codec.js';
import { rgbToWarcraftColor } from './warcraft-color.js';

const V3 = (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]);
const clone = (value) => structuredClone(value);
export const NODE_TYPES = Object.freeze({
  Bone: ['Bones', 'BONE', 256], Helper: ['Helpers', 'HELP', 0],
  Attachment: ['Attachments', 'ATCH', 2048], Light: ['Lights', 'LITE', 512],
  EventObject: ['EventObjects', 'EVTS', 1024], CollisionShape: ['CollisionShapes', 'CLID', 8192],
  ParticleEmitter: ['ParticleEmitters', 'PREM', 4096],
  ParticleEmitter2: ['ParticleEmitters2', 'PRE2', 4096],
  RibbonEmitter: ['RibbonEmitters', 'RIBB', 16384],
  ParticleEmitterPopcorn: ['ParticleEmitterPopcorns', 'CORN', 4096],
});
const SECTION_TYPES = {
  Version: ['Version', 'VERS'], Info: ['Model', 'MODL'],
  Sequences: ['Sequences', 'SEQS'], GlobalSequences: ['GlobalSequences', 'GLBS'],
  Materials: ['Materials', 'MTLS'], Textures: ['Textures', 'TEXS'],
  TextureAnims: ['TextureAnims', 'TXAN'], Geosets: ['Geoset', 'GEOS'],
  GeosetAnims: ['GeosetAnim', 'GEOA'], PivotPoints: ['PivotPoints', 'PIVT'],
  Cameras: ['Camera', 'CAMS'], FaceFX: ['FaceFX', 'FAFX'], BindPoses: ['BindPose', 'BPOS'],
  Gliders: ['Glider', 'DILG'],
  ...Object.fromEntries(Object.entries(NODE_TYPES).map(([name, [key, tag]]) => [key, [name, tag]])),
};
const MDL_TO_KEY = Object.fromEntries(Object.entries(SECTION_TYPES).map(([k, v]) => [v[0], k]));
const TEXTURE_SLOTS = ['TextureID', 'NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID'];
const nodeCollections = (model) => Object.values(NODE_TYPES).flatMap(([key]) => model[key] || []);
const fingerprint = (value) => JSON.stringify(value, (key, val) => {
  if (ArrayBuffer.isView(val)) return { $type: val.constructor.name, $data: Array.from(val) };
  if (typeof val === 'number' && !Number.isFinite(val)) return { $number: String(val) };
  return val;
});
function sectionFingerprint(model, key) {
  // PivotPoint is an in-memory alias; its serialized data belongs only to PIVT.
  if (Object.values(NODE_TYPES).some(([collection]) => collection === key)) {
    return fingerprint((model[key] || []).map(({ PivotPoint, ...node }) => node));
  }
  return fingerprint(model[key]);
}
const changedKeys = (before, after) => Object.keys(SECTION_TYPES).filter((key) => sectionFingerprint(before, key) !== sectionFingerprint(after, key));
const nodeCollectionKeys = new Set(Object.values(NODE_TYPES).map(([key]) => key));
const ignoreHistoryAlias = (path) => path[0] === 'Nodes' || path.length === 3 && nodeCollectionKeys.has(path[0]) && path[2] === 'PivotPoint';

function emptyModel(version = 800, name = 'Untitled') {
  const model = {
    Version: version, Info: { Name: name, MinimumExtent: V3(), MaximumExtent: V3(), BoundsRadius: 0, BlendTime: 150 },
    Nodes: [],
  };
  for (const key of Object.keys(SECTION_TYPES)) if (!(key in model) && key !== 'Version') model[key] = [];
  return model;
}

/** Byte offsets are intentional: non-ASCII text, comments and line endings survive edits. */
export function scanMdlSections(input) {
  const bytes = Buffer.from(input);
  const sections = [];
  let start = -1, name = '', depth = 0, i = 0;
  while (i < bytes.length) {
    const c = bytes[i];
    if (c === 47 && bytes[i + 1] === 47) {
      i += 2; while (i < bytes.length && bytes[i] !== 10 && bytes[i] !== 13) i++;
    } else if (c === 47 && bytes[i + 1] === 42) {
      const end = bytes.indexOf(Buffer.from('*/'), i + 2);
      if (end < 0) throw new Error('Unterminated MDL block comment.');
      i = end + 2;
    } else if (c === 34) {
      const end = mdlStringEnd(bytes, i);
      if (end < 0) throw new Error('Unterminated MDL string.');
      i = end;
    } else if (c === 123) { depth++; i++; }
    else if (c === 125) {
      if (--depth < 0) throw new Error('Unmatched MDL closing brace.');
      i++;
      if (depth === 0 && start >= 0) {
        sections.push({ name, key: MDL_TO_KEY[name], start, end: i }); start = -1;
      }
    } else if (depth === 0 && start < 0 && ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95)) {
      start = i++;
      while (i < bytes.length && /[A-Za-z0-9_]/.test(String.fromCharCode(bytes[i]))) i++;
      name = bytes.subarray(start, i).toString('ascii');
    } else i++;
  }
  if (depth !== 0) throw new Error('Unterminated MDL section.');
  if (start >= 0) throw new Error(`Incomplete MDL section ${name}.`);
  return sections;
}

function stripBlockComments(text) {
  // Only used for semantic decoding; source bytes remain untouched.
  return text.replace(/"[^"]*"|\/\*[\s\S]*?\*\//g, (match) => match.startsWith('/*') ? ' ' : match);
}
// The upstream writer emits one empty triangle group; its parser rejects that.
// Zero groups represent an editable geoset containing loose points correctly.
function emptyFaceGroups(text) {
  return text.replace(/"(?:\\.|[^"\\])*"|Faces\s+1\s+0\s*\{\s*Triangles\s*\{\s*\{\s*\},?\s*\}\s*\}/g, match => match.startsWith('"') ? match : 'Faces 0 0 { Triangles { } }');
}
function decodeMdl(bytes, sections) {
  // war3-model assumes a node exists at each pivot index when parsing MDL.
  // Parse pivots separately so valid sparse object IDs remain stable after deletion.
  const eventGlobals = new Map();
  const body = sections.filter((s) => s.key && s.key !== 'PivotPoints').map((s) => {
    let source = bytes.subarray(s.start, s.end);
    if (s.key === 'EventObjects') {
      const prepared = prepareMdlEventObject(source); source = prepared.bytes;
      if (prepared.globalSeqId != null) eventGlobals.set(prepared.objectId, prepared.globalSeqId);
    }
    return stripBlockComments(source.toString('utf8'));
  }).join('\n');
  const compatible = prepareCompatibleMdl(emptyFaceGroups(body));
  const model = parseMDL(compatible.text);
  compatible.restore(model);
  for (const node of model.ParticleEmitters || []) node.Flags |= 4096;
  restoreMdlPopcornRotations(bytes, sections, model);
  for (const event of model.EventObjects || []) if (eventGlobals.has(event.ObjectId)) event.GlobalSeqId = eventGlobals.get(event.ObjectId);
  // MDL expresses the color flag by including Color; it has no separate flag
  // token. war3-model reads that property but leaves Flags at zero. MDX has an
  // explicit flag and must retain it, so infer this only on the MDL decode path.
  for (const anim of model.GeosetAnims || []) if (anim.Color != null) anim.Flags = (anim.Flags || 0) | 2;
  const pivots = sections.filter((s) => s.key === 'PivotPoints');
  if (pivots.length) {
    model.PivotPoints = readMdlPivotPoints(bytes.subarray(pivots.at(-1).start, pivots.at(-1).end));
  }
  normalizeModel(model);
  return model;
}
function normalizeModel(model, previous) {
  for (const key of Object.keys(SECTION_TYPES)) {
    if (key !== 'Version' && key !== 'Info' && model[key] == null) model[key] = [];
  }
  model.Nodes = [];
  for (const node of nodeCollections(model)) {
    const id = node.ObjectId;
    if (!Number.isInteger(id) || id < 0 || id > 1000000) continue;
    if (node.Parent === undefined) node.Parent = null;
    const previousNode = previous?.Nodes?.[id];
    const oldPivot = previous?.PivotPoints?.[id];
    const nodePivotChanged = previousNode && fingerprint(previousNode.PivotPoint) !== fingerprint(node.PivotPoint);
    const arrayPivotChanged = oldPivot && fingerprint(oldPivot) !== fingerprint(model.PivotPoints[id]);
    if (nodePivotChanged && !arrayPivotChanged) model.PivotPoints[id] = node.PivotPoint;
    if (!model.PivotPoints[id]) model.PivotPoints[id] = node.PivotPoint || V3();
    node.PivotPoint = model.PivotPoints[id];
    model.Nodes[id] = node;
  }
  // Pivot arrays require entries for unused IDs too; these are reserved zero pivots.
  for (let i = 0; i < model.PivotPoints.length; i++) model.PivotPoints[i] ||= V3();
  const visited = new Set();
  function normalizeTracks(value) {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value.Keys) && value.GlobalSeqId === undefined) value.GlobalSeqId = null;
    for (const child of Object.values(value)) normalizeTracks(child);
  }
  normalizeTracks(model);
  for (const material of model.Materials) for (const layer of material.Layers || []) {
    if (layer.TVertexAnimId === undefined) layer.TVertexAnimId = null;
    layer.CoordId ??= 0; layer.FilterMode ??= 0; layer.Shading ??= 0;
  }
  for (const node of model.Bones) { node.GeosetId ??= null; node.GeosetAnimId ??= null; }
  for (const node of model.Lights) { node.QuadraticFalloff ??= 0.0005; node.LinearFalloff ??= 0; node.Damping ??= 0.00001; }
  for (const [i, geoset] of model.Geosets.entries()) {
    if (previous && fingerprint(previous.Geosets[i]?.Faces) !== fingerprint(geoset.Faces) && geoset.PrimitiveCounts && Array.from(geoset.PrimitiveCounts).reduce((sum,n)=>sum+n,0) !== geoset.Faces.length) {
      geoset.PrimitiveTypes = Uint32Array.of(4); geoset.PrimitiveCounts = Uint32Array.of(geoset.Faces.length);
    }
  }
  // The MDL writer omits these zero-valued emitter fields. Its parser leaves
  // them absent, but the MDX writer requires numbers (undefined becomes NaN).
  for (const node of model.ParticleEmitters2) for (const field of ['TailLength', 'Time', 'LifeSpan', 'PriorityPlane', 'ReplaceableId', 'Rows', 'Columns']) node[field] ??= 0;
  for (const node of model.ParticleEmitters) for (const field of ['EmissionRate','Gravity','Longitude','Latitude','LifeSpan','InitVelocity']) node[field] ??= 0;
  for (const node of model.ParticleEmitterPopcorns) {
    for (const field of ['LifeSpan','EmissionRate','Speed','Alpha']) node[field] ??= 1;
    node.ReplaceableId ??= 0; node.Path ??= ''; node.AnimVisibilityGuide ??= ''; node.Color ??= V3(1,1,1);
  }
  for (const node of model.RibbonEmitters) {
    node.HeightAbove ??= 0; node.HeightBelow ??= 0; node.Alpha ??= 1; node.TextureSlot ??= 0;
  }
  for (const item of [model.Info, ...model.Sequences, ...model.Geosets, ...model.Geosets.flatMap(g=>g.Anims || [])]) if (item) {
    item.MinimumExtent ||= V3(); item.MaximumExtent ||= V3(); item.BoundsRadius ??= 0;
  }
  if (model.Info) model.Info.BlendTime ??= 0;
  for (const texture of model.Textures) { texture.Image ??= ''; texture.ReplaceableId ??= 0; texture.Flags ??= 0; }
  for (const node of model.ParticleEmitters2) node.Squirt = !!node.Squirt;
  updateCounts(model);
}

function surgicalMdl(original, sections, generated, keys) {
  const fresh = scanMdlSections(generated);
  const replacements = new Map();
  for (const key of keys) replacements.set(key, Buffer.concat(fresh.filter((s) => s.key === key).flatMap((s) => [generated.subarray(s.start, s.end), Buffer.from('\n')])));
  const parts = []; const inserted = new Set(); let cursor = 0;
  for (const section of sections) {
    if (!replacements.has(section.key)) continue;
    parts.push(original.subarray(cursor, section.start));
    if (!inserted.has(section.key)) { parts.push(replacements.get(section.key)); inserted.add(section.key); }
    cursor = section.end;
  }
  parts.push(original.subarray(cursor));
  for (const [key, bytes] of replacements) if (!inserted.has(key) && bytes.length) parts.push(Buffer.from('\n'), bytes);
  return Buffer.concat(parts);
}
function surgicalMdx(original, container, generated, keys) {
  const fresh = parseMdx(generated);
  if (fresh.hasErrors) throw new Error('Generated MDX has an invalid chunk structure.');
  const tags = new Set(keys.map((key) => SECTION_TYPES[key][1]));
  const replacements = new Map([...tags].map((tag) => [tag, Buffer.concat(fresh.chunks.filter((chunk) => chunk.tag === tag).map((chunk) => generated.subarray(chunk.offset, chunk.payloadOffset + chunk.declaredSize)))]));
  const inserted = new Set(); const parts = [original.subarray(0, 4)];
  for (const chunk of container.chunks) {
    if (!tags.has(chunk.tag)) parts.push(original.subarray(chunk.offset, chunk.payloadOffset + chunk.declaredSize));
    else if (!inserted.has(chunk.tag)) { parts.push(replacements.get(chunk.tag)); inserted.add(chunk.tag); }
  }
  for (const [tag, bytes] of replacements) if (!inserted.has(tag)) parts.push(bytes);
  parts.push(container.trailingBytes);
  return Buffer.concat(parts);
}

export class EditorDocument {
  constructor(input, name = 'Untitled.mdl', options = {}) {
    this.name = name;
    this.revision = 0;
    this.history = [];
    this._historyStore = new HistoryStore(options.history);
    this._serializedStates = new WeakMap();
    this._loadSource(input);
    this.model = emptyModel(this.version || 800, name);
    this.readOnly = this._sourceErrors.length > 0 || !SUPPORTED_FORMAT_VERSIONS.includes(this.version);
    if (!this.readOnly) {
      try {
        this.model = this.format === 'mdx' ? parseMDX(this._original) : decodeMdl(this._original, this._sections);
        if (this.format === 'mdx') {
          restoreMdxEventGlobalSequences(this._original, this.model);
          this.model.GeosetAnims = convertMdxGeosetColorTracks(this.model.GeosetAnims);
        }
        normalizeModel(this.model);
      } catch (error) {
        this.readOnly = true;
        this._sourceErrors.push({ severity: 'error', code: 'SEMANTIC_DECODE_FAILED', message: `Editing unavailable: ${error.message}. The original file can still be copied exactly.` });
      }
    }
    this._savedModel = clone(this.model);
    // One committed shadow supports closed-over inspector edits and rollback.
    // Each successful edit updates only its changed paths; history retains deltas.
    this._committedModel = clone(this.model);
  }
  _loadSource(input) {
    this._original = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input instanceof ArrayBuffer ? new Uint8Array(input) : input);
    this.format = this._original.subarray(0, 4).toString('ascii') === 'MDLX' ? 'mdx' : 'mdl';
    this._container = this.format === 'mdx' ? parseMdx(this._original) : parseMdl(this._original);
    this.version = this._container.version;
    this._sourceErrors = this._container.diagnostics.filter((d) => d.severity === 'error');
    this._sourceWarnings = this._container.diagnostics.filter((d) => d.severity !== 'error');
    this._sections = [];
    if (this.format === 'mdl') {
      try { this._sections = scanMdlSections(this._original); }
      catch (error) { this._sourceErrors.push({ severity: 'error', code: 'MDL_STRUCTURE', message: error.message }); }
    }
  }
  get originalBytes() { return new Uint8Array(this._original); }
  _changedKeys() {
    if (this._changeCache?.revision !== this.revision) this._changeCache = { revision: this.revision, keys: changedKeys(this._savedModel, this.model) };
    return this._changeCache.keys;
  }
  get dirty() { return this._changedKeys().length > 0; }
  get canUndo() { return this._historyStore.stats.undoSteps > 0; }
  get canRedo() { return this._historyStore.stats.redoSteps > 0; }
  get historyStats() { return this._historyStore.stats; }
  configureHistory(options) { return this._historyStore.configure(options); }
  _recordHistory(entry) {
    this.history.push(entry);
    const limit = Math.max(1, this.historyStats.maxSteps);
    if (this.history.length > limit) this.history.splice(0, this.history.length - limit);
  }
  get diagnostics() {
    if (this._diagnosticCache?.revision === this.revision) return this._diagnosticCache.diagnostics;
    const diagnostics = [...this._sourceErrors, ...this._sourceWarnings];
    if (!this.readOnly) diagnostics.push(...validateModel(this.model));
    const opaque = this._unknownSections();
    if (opaque.length) diagnostics.push({ severity: 'info', code: 'OPAQUE_DATA_PRESERVED', message: `Unrecognized source data is retained: ${opaque.join(', ')}.` });
    this._diagnosticCache = { revision: this.revision, diagnostics };
    return diagnostics;
  }
  _unknownSections() {
    const known = new Set(Object.values(SECTION_TYPES).map((s) => s[1]));
    return this.format === 'mdx' ? [...new Set(this._container.chunks.filter((c) => !known.has(c.tag)).map((c) => c.tag))] : [...new Set(this._sections.filter((s) => !s.key).map((s) => s.name))];
  }
  convertVersion(target) {
    if (this.readOnly) throw new Error('This document is read-only.');
    if (target === this.model.Version) return false;
    const issues = versionConversionIssues(this.model, target);
    if (this._unknownSections().length) issues.push('Unrecognized source sections prevent safe version conversion.');
    if (issues.length) throw new Error(issues.join('\n'));
    // Prove the target writer/reader accepts the complete converted content before committing.
    const candidate=clone(this.model); normalizeVersionFields(candidate,target);
    const bytes=writeMdxEventGlobalSequences(generateMDX({...candidate,GeosetAnims:convertMdxGeosetColorTracks(candidate.GeosetAnims),BindPoses:candidate.BindPoses?.length?candidate.BindPoses:undefined}),candidate);
    const check=openDocument(bytes,'converted.mdx');
    if(check.readOnly || check.version!==target || check.diagnostics.some(d=>d.severity==='error')) throw new Error('Target format verification failed. The model was kept.');
    assertModelEquivalent(candidate,check.model,{keys:Object.keys(SECTION_TYPES)});
    for(const key of Object.keys(SECTION_TYPES)) if(Array.isArray(candidate[key]) && candidate[key].length!==check.model[key]?.length) throw new Error('Target conversion changed '+key+' count.');
    this._versionConversion=true;
    try { return this.apply('Convert to MDX'+target,['Version','Materials','Geosets'],model=>normalizeVersionFields(model,target)); }
    finally { this._versionConversion=false; }
  }
  apply(label, sections, mutator) {
    if (this.readOnly) throw new Error(`This document is read-only (format ${this.version ?? 'unknown'} or unsupported data).`);
    if (typeof mutator !== 'function') throw new TypeError('apply requires a model mutator function.');
    if (this._applying) throw new Error('Nested document edits are not supported.');
    const before = this._committedModel, next = this.model;
    let result, changes, changed, historyEntry;
    this._applying = true;
    try {
      result = mutator(next);
      if (result && typeof result.then === 'function') throw new Error('Document edits must be synchronous.');
      if (next.Version !== before.Version && !this._versionConversion) throw new Error('Changing the model version is not supported; no automatic downgrades are performed.');
      normalizeModel(next, before);
      const existingErrors = this._committedErrors ||= new Set(validateModel(before).filter((d) => d.severity === 'error').map((d) => `${d.code}:${d.path}`));
      const nextDiagnostics = validateModel(next);
      const errors = nextDiagnostics.filter((d) => d.severity === 'error' && !existingErrors.has(`${d.code}:${d.path}`));
      if (errors.length) throw new Error(errors.slice(0, 4).map((d) => d.message).join('\n'));
      changes = createChanges(before, next, { ignore: ignoreHistoryAlias });
      changed = [...new Set(changes.map((change) => change.path[0]).filter((key) => key in SECTION_TYPES))];
      if (changes.length) historyEntry = this._historyStore.prepare({ label, sections: changed, changes });
      // Prepare the shadow before committing history. A thrown mutator, invalid
      // result or failed delta allocation leaves both undo and redo untouched.
      applyChanges(before, changes);
      normalizeModel(before);
      this._committedErrors = new Set(nextDiagnostics.filter((d) => d.severity === 'error').map((d) => `${d.code}:${d.path}`));
    } catch (error) { this.model = clone(before); throw error; }
    finally { this._applying = false; }
    if (!changes.length) return false;
    this._historyStore.commit(historyEntry);
    this.model = next;
    this.version = this.model.Version;
    this.revision++;
    this._recordHistory({ label, sections: changed, requestedSections: [...(sections || [])], revision: this.revision });
    return result === undefined ? true : result;
  }
  undo() {
    if (this._applying) throw new Error('Cannot undo inside a document edit.');
    const state = this._historyStore.undo((changes, direction) => this._applyHistory(changes, direction));
    if (!state) return false;
    this.revision++;
    this._recordHistory({ label: `Undo: ${state.label}`, sections: state.sections, revision: this.revision });
    return true;
  }
  redo() {
    if (this._applying) throw new Error('Cannot redo inside a document edit.');
    const state = this._historyStore.redo((changes, direction) => this._applyHistory(changes, direction));
    if (!state) return false;
    this.revision++;
    this._recordHistory({ label: `Redo: ${state.label}`, sections: state.sections, revision: this.revision });
    return true;
  }
  _applyHistory(changes, direction) {
    // Apply to the shadow first: all paths and allocations are checked before
    // mutation, and the live document remains intact if recovery data is invalid.
    applyChanges(this._committedModel, changes, direction);
    normalizeModel(this._committedModel);
    try { applyChanges(this.model, changes, direction); normalizeModel(this.model); }
    catch { this.model = clone(this._committedModel); }
    this.version = this.model.Version;
    this._committedErrors = null;
  }
  captureRecoveryState({ includeHistory = true } = {}) {
    if (this._applying) throw new Error('Cannot capture recovery inside a document edit.');
    // Clone the complete graph once, avoiding two temporary copies of a large
    // undo cache while the desktop host checkpoints the document to disk.
    return clone({ schema: 'mdlvis-document-recovery', version: 1, name: this.name,
      originalBytes: new Uint8Array(this._original.buffer, this._original.byteOffset, this._original.byteLength), model: this.model, savedModel: this._savedModel,
      revision: this.revision, history: includeHistory ? this._historyStore._recoveryState() : null,
      activity: this.history });
  }
  static restoreRecoveryState(state) {
    if (state?.schema !== 'mdlvis-document-recovery' || state.version !== 1 || !(state.originalBytes instanceof Uint8Array) || typeof state.name !== 'string' || !state.model) throw new Error('Invalid document recovery data.');
    const doc = new EditorDocument(state.originalBytes, state.name);
    if (!state.savedModel || state.savedModel.Version !== doc.version || ![800,1000,doc.version].includes(state.model.Version)) throw new Error('Recovery model version does not match its original file.');
    const recovered = clone(state.model);
    normalizeModel(recovered);
    const existingErrors = new Set(validateModel(doc.model).filter((d) => d.severity === 'error').map((d) => `${d.code}:${d.path}`));
    const errors = validateModel(recovered).filter((d) => d.severity === 'error' && !existingErrors.has(`${d.code}:${d.path}`));
    if (errors.length) throw new Error(`Recovery model is invalid: ${errors[0].message}`);
    doc.model = recovered; doc.version = recovered.Version; doc._committedModel = clone(recovered);
    doc._savedModel = clone(state.savedModel); normalizeModel(doc._savedModel);
    if (state.history) doc._historyStore = HistoryStore.restore(state.history);
    doc.revision = Number.isSafeInteger(state.revision) && state.revision >= 0 ? state.revision : 0;
    doc.history = Array.isArray(state.activity) ? clone(state.activity.slice(-Math.max(1, doc.historyStats.maxSteps))) : [];
    return doc;
  }
  saveImpact(format = this.format) {
    format = format.toLowerCase();
    const conversion = format !== this.format || this.model.Version !== this._container.version;
    const changed = this._changedKeys();
    const warnings = [];
    if (conversion) warnings.push('Format conversion regenerates the entire file. Unknown chunks, unknown MDL sections, comments and unsupported fields cannot be carried into the other format.');
    else if (changed.length) warnings.push('Changed sections are regenerated. Their formatting, comments and unsupported subfields may change; all other source sections remain byte-for-byte intact.');
    if (this.version === 900) warnings.push('Version 900 support in the parser library is experimental.');
    if (this.readOnly && conversion) warnings.push('This document cannot be converted because its version or source data is unsupported.');
    if (conversion && this.model.Geosets?.some((g) => g.SkinWeights?.length) && format === 'mdl') warnings.push('Weighted HD geometry requires a compatible Reforged MDL consumer.');
    const stringIssues = (conversion || changed.length) && !this.readOnly ? serializationStringIssues(this.model, format, conversion ? Object.keys(SECTION_TYPES) : changed) : [];
    warnings.push(...stringIssues);
    const unknown = this._unknownSections();
    if (conversion && unknown.length) warnings.push(`Cannot convert unrecognized source data: ${unknown.join(', ')}.`);
    return { format, conversion, exact: !conversion && changed.length === 0, readOnly: this.readOnly, changedSections: changed.map((key) => key === 'Info' ? 'Model' : key), preservedUnknown: unknown, warnings, canSave: ['mdl', 'mdx'].includes(format) && (!this.readOnly || !conversion && !changed.length) && !stringIssues.length && !(conversion && unknown.length) };
  }
  serialize(format = this.format) {
    format = format.toLowerCase();
    const impact = this.saveImpact(format);
    if (!impact.canSave) throw new Error(`This document cannot be saved in that format. ${impact.warnings.at(-1) || 'An exact copy in its original format is available.'}`);
    const remember = (data) => {
      const bytes = new Uint8Array(data);
      // Saving is asynchronous in the desktop host. Associate the bytes with
      // their model revision so an edit during disk I/O cannot be marked saved.
      this._serializedStates.set(bytes, { model: clone(this.model), revision: this.revision });
      return bytes;
    };
    if (impact.exact) return remember(this._original);
    // MDL's Color property itself enables tinting. Omit disabled MDX colors on
    // text export without changing the editable model or its cached RGB values.
    // war3-model allocates 12 bytes for an empty Reforged BindPoses array but
    // emits no BPOS chunk. Omit that empty export-only property to avoid junk
    // trailing bytes; the editable model and any nonempty bind poses stay intact.
    const exportModel = format === 'mdl' ? { ...this.model, ParticleEmitterPopcorns: prepareMdlPopcornColors(this.model.ParticleEmitterPopcorns), GeosetAnims: this.model.GeosetAnims.map(anim => (anim.Flags & 2) ? anim : { ...anim, Color: null }) } : { ...this.model, GeosetAnims: convertMdxGeosetColorTracks(this.model.GeosetAnims), BindPoses: this.model.BindPoses?.length ? this.model.BindPoses : undefined };
    const mdlModel = format === 'mdl' ? { ...exportModel, Geosets: exportModel.Geosets.map(g=>({...g,TVertices:g.TVertices.length?g.TVertices:[new Float32Array()]})), CollisionShapes: exportModel.CollisionShapes.map(n=>[1,3].includes(n.Shape)?{...n,Shape:0}:n) } : null;
    let generated = format === 'mdl' ? finishCompatibleMdl(Buffer.from(emptyFaceGroups(generateMDL(mdlModel)), 'utf8'), this.model) : Buffer.from(generateMDX(exportModel));
    if (format === 'mdl') generated = writeMdlUVSets(generated, scanMdlSections(generated), exportModel);
    generated = format === 'mdl' ? writeMdlEventGlobalSequences(generated, scanMdlSections(generated), exportModel) : writeMdxEventGlobalSequences(generated, exportModel);
    if (!impact.conversion) generated = format === 'mdx' ? preserveMdxRecords(this._original, generated, this._savedModel, this.model, SECTION_TYPES) : preserveMdlRecords(this._original, generated, this._savedModel, this.model, SECTION_TYPES);
    const keys = this._changedKeys();
    const output = impact.conversion ? generated : format === 'mdl' ? surgicalMdl(this._original, this._sections, generated, keys) : surgicalMdx(this._original, this._container, generated, keys);
    // A writer can succeed while emitting a dialect the reader cannot parse.
    // Check the final surgical/conversion result before allowing it onto disk.
    const reopened = openDocument(output, `validation.${format}`);
    if (reopened.readOnly) throw new Error(`Save verification failed: ${reopened.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message).join(' ') || 'Generated model is not editable.'}`);
    if (reopened.version !== this.version) throw new Error('Save verification failed: model version changed.');
    assertModelEquivalent(this.model, reopened.model, { keys: Object.keys(SECTION_TYPES) });
    for (const key of Object.keys(SECTION_TYPES)) if (Array.isArray(this.model[key]) && this.model[key].length !== reopened.model[key]?.length) throw new Error(`Save verification failed: ${key} count changed during serialization.`);
    for (let index = 0; index < this.model.Geosets.length; index++) if (this.model.Geosets[index].TVertices.length !== reopened.model.Geosets[index].TVertices.length) throw new Error(`Save verification failed: Geoset ${index} UV set count changed during serialization.`);
    const existingErrors = new Set(validateModel(this.model).filter((d) => d.severity === 'error').map((d) => `${d.code}:${d.path}`));
    const newErrors = reopened.diagnostics.filter((d) => d.severity === 'error' && !existingErrors.has(`${d.code}:${d.path}`));
    if (newErrors.length) throw new Error(`Save verification failed: ${newErrors.slice(0, 4).map((d) => d.message).join(' ')}`);
    return remember(output);
  }
  markSaved(bytes, name = this.name) {
    const savedBytes = bytes || this.serialize();
    const savedState = this._serializedStates.get(savedBytes);
    const savedModel = savedState ? savedState.model : openDocument(savedBytes, name).model;
    this.name = name;
    this._loadSource(savedBytes);
    this.version = this.model.Version;
    this._savedModel = clone(savedModel);
    this.revision++;
  }
}
export function openDocument(bytes, name, options) { return new EditorDocument(bytes, name, options); }

function serializationStringIssues(model, format, keys) {
  const issues = [], seen = new Set();
  function walk(value, path, key) {
    if (typeof value === 'string') {
      if (format === 'mdl' && (/["\0]/.test(value) || key !== 'AnimVisibilityGuide' && /[\r\n]/.test(value))) issues.push(`${path} contains a quote, newline or NUL that this MDL writer cannot safely encode.`);
      if (format === 'mdx') {
        if ([...value].some((char) => char.charCodeAt(0) > 255)) issues.push(`${path} contains Unicode characters that this MDX writer cannot encode. Save as MDL or use a compatible name.`);
        const limit = ['Image', 'Path', 'AnimationFile', 'AnimVisibilityGuide'].includes(key) ? 260 : ['Name', 'Shader'].includes(key) ? 80 : null;
        if (limit && value.length > limit) issues.push(`${path} exceeds its ${limit}-byte MDX field; saving would truncate it.`);
      }
      return;
    }
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || seen.has(value)) return;
    seen.add(value);
    for (const [name, child] of Object.entries(value)) walk(child, `${path}.${name}`, name);
  }
  for (const key of keys) walk(model[key], key, key);
  return issues;
}

export function validateModel(model) {
  const diagnostics = [];
  const add = (severity, code, message, path) => diagnostics.push({ severity, code, message, path });
  if (!model) return [{ severity: 'error', code: 'NO_MODEL', message: 'No model is loaded.' }];
  const nodes = nodeCollections(model), ids = new Map();
  for (const node of nodes) {
    const path = `Nodes[${node.ObjectId}]`;
    if (!Number.isInteger(node.ObjectId) || node.ObjectId < 0 || node.ObjectId > 1000000) add('error', 'NODE_ID', `Node ${node.Name} has an invalid object ID.`, path);
    if (ids.has(node.ObjectId)) add('error', 'DUPLICATE_NODE_ID', `Object ID ${node.ObjectId} is used by more than one node.`, path);
    ids.set(node.ObjectId, node);
    if (!node.PivotPoint || node.PivotPoint.length !== 3) add('error', 'NODE_PIVOT', `Node ${node.Name} has no valid pivot point.`, path);
  }
  for (const node of nodes) {
    const path = `Nodes[${node.ObjectId}]`;
    if (node.Parent != null && node.Parent !== -1 && !ids.has(node.Parent)) add('error', 'NODE_PARENT', `Node ${node.Name} references missing parent ${node.Parent}.`, path);
    const seen = new Set([node.ObjectId]); let cursor = node;
    while (cursor && cursor.Parent != null && cursor.Parent !== -1) {
      if (seen.has(cursor.Parent)) { add('error', 'HIERARCHY_CYCLE', `Node ${node.Name} would create a hierarchy cycle.`, path); break; }
      seen.add(cursor.Parent); cursor = ids.get(cursor.Parent);
    }
  }
  for (const [gi, g] of (model.Geosets || []).entries()) {
    const path = `Geosets[${gi}]`, count = (g.Vertices?.length || 0) / 3;
    if (!Number.isInteger(count) || !count) add('error', 'VERTEX_COUNT', `Geoset ${gi} has invalid or empty vertex data.`, path);
    if (count > 65536) add('error', 'FACE_INDEX_LIMIT', `Geoset ${gi} exceeds MDX's 16-bit face index capacity; split it into geosets.`, path);
    if (g.Normals?.length !== g.Vertices?.length) add('error', 'NORMAL_COUNT', `Geoset ${gi} normals do not match its vertices.`, path);
    if (!ArrayBuffer.isView(g.Faces) || g.Faces.length % 3) add('error', 'TRIANGLE_COUNT', `Geoset ${gi} has invalid triangle data.`, path);
    if (g.Faces?.some((index) => index >= count || index < 0 || !Number.isInteger(index))) add('error', 'FACE_REFERENCE', `Geoset ${gi} contains a face with a missing vertex.`, path);
    if (!Number.isInteger(g.MaterialID) || !model.Materials?.[g.MaterialID]) add('error', 'MATERIAL_REFERENCE', `Geoset ${gi} references missing material ${g.MaterialID}.`, path);
    if (!g.TVertices?.length) add('warning', 'MISSING_UV', `Geoset ${gi} has no texture coordinates.`, path);
    if (g.TVertices?.length > 16) add('error', 'UV_SET_LIMIT', `Geoset ${gi} exceeds the 16 UV set limit.`, path);
    for (const [uv, values] of (g.TVertices || []).entries()) if (values.length !== count * 2) add('error', 'UV_COUNT', `Geoset ${gi} UV set ${uv} has a mismatched vertex count.`, `${path}.TVertices[${uv}]`);
    if (g.VertexGroup?.length !== count) add('error', 'VERTEX_GROUP_COUNT', `Geoset ${gi} vertex groups do not match its vertices.`, path);
    if (g.VertexGroup?.some((index) => index >= (g.Groups?.length || 0))) add('error', 'GROUP_REFERENCE', `Geoset ${gi} references a missing matrix group.`, path);
    for (const id of new Set((g.Groups || []).flat())) if (!ids.has(id)) add('error', 'BONE_REFERENCE', `Geoset ${gi} references missing matrix node ${id}.`, `${path}.Groups[${id}]`);
    if (g.SkinWeights?.length) {
      if (g.SkinWeights.length !== count * 8) add('error', 'SKIN_COUNT', `Geoset ${gi} skin weights do not match its vertices.`, path);
      if (g.SkinWeights.some((value,index)=>!Number.isInteger(value)||value<0||value>(index%8<4 && model.Version>=1400?65535:255))) add('error', 'SKIN_VALUE_RANGE', `Geoset ${gi} skin indices or weights exceed their format range.`, path);
      const missing = new Set(); let invalidWeights = false;
      for (let i = 0; i < g.SkinWeights.length; i += 8) {
        let total = 0;
        for (let j = 0; j < 4; j++) { const weight = g.SkinWeights[i + 4 + j]; total += weight; if (weight && !ids.has(g.SkinWeights[i + j])) missing.add(g.SkinWeights[i + j]); }
        if (total !== 255) invalidWeights = true;
      }
      for (const id of missing) add('error', 'SKIN_BONE_REFERENCE', `Geoset ${gi} weights reference missing node ${id}.`, `${path}.SkinWeights[${id}]`);
      if (invalidWeights) add('warning', 'SKIN_WEIGHT_SUM', `Geoset ${gi} has vertex weights that do not total 255.`, path);
    }
    if (g.Tangents?.length && g.Tangents.length !== count * 4) add('error', 'TANGENT_COUNT', `Geoset ${gi} tangents do not match its vertices.`, path);
    let degenerate = 0;
    for (let i = 0; i < (g.Faces?.length || 0); i += 3) if (g.Faces[i] === g.Faces[i + 1] || g.Faces[i] === g.Faces[i + 2] || g.Faces[i + 1] === g.Faces[i + 2]) degenerate++;
    if (degenerate) add('warning', 'DEGENERATE_FACES', `Geoset ${gi} has ${degenerate} triangles with repeated vertices.`, path);
  }
  const checkTexture = (id, path) => { if (id != null && id !== -1 && (!Number.isInteger(id) || !model.Textures?.[id])) add('error', 'TEXTURE_REFERENCE', `${path} references missing texture ${id}.`, path); };
  for (const [mi, material] of (model.Materials || []).entries()) {
    if (!material.Layers?.length) add('error', 'EMPTY_MATERIAL', `Material ${mi} needs at least one layer.`, `Materials[${mi}]`);
    for (const [li, layer] of (material.Layers || []).entries()) {
      const path = `Materials[${mi}].Layers[${li}]`;
      for (const slot of TEXTURE_SLOTS) if (typeof layer[slot] === 'number') checkTexture(layer[slot], `${path}.${slot}`);
      else if (layer[slot]?.Keys) for (const key of layer[slot].Keys) for (const id of key.Vector) checkTexture(id, `${path}.${slot}`);
      if (layer.TVertexAnimId != null && layer.TVertexAnimId !== -1 && !model.TextureAnims?.[layer.TVertexAnimId]) add('error', 'TEXTURE_ANIM_REFERENCE', `${path} references a missing texture animation.`, path);
      if (typeof layer.Alpha === 'number' && (layer.Alpha < 0 || layer.Alpha > 1)) add('warning', 'ALPHA_RANGE', `${path} alpha is outside 0–1.`, path);
    }
  }
  for (const [i, anim] of (model.GeosetAnims || []).entries()) if (!model.Geosets?.[anim.GeosetId]) add('error', 'GEOSET_ANIM_REFERENCE', `Geoset animation ${i} references missing geoset ${anim.GeosetId}.`, `GeosetAnims[${i}]`);
  for (const [i, glider] of (model.Gliders || []).entries()) if (!model.Geosets?.[glider.GeosetId]) add('error', 'GLIDER_REFERENCE', `Glider ${i} references missing geoset ${glider.GeosetId}.`, `Gliders[${i}]`);
  for (const node of model.Bones || []) {
    if (node.GeosetId != null && node.GeosetId !== -1 && !model.Geosets?.[node.GeosetId]) add('error', 'BONE_GEOSET_REFERENCE', `Bone ${node.Name} references missing geoset ${node.GeosetId}.`, `Nodes[${node.ObjectId}].GeosetId`);
    if (node.GeosetAnimId != null && node.GeosetAnimId !== -1 && !model.GeosetAnims?.[node.GeosetAnimId]) add('error', 'BONE_GEOSET_ANIM_REFERENCE', `Bone ${node.Name} references a missing geoset animation.`, `Nodes[${node.ObjectId}].GeosetAnimId`);
  }
  for (const node of model.ParticleEmitters2 || []) checkTexture(node.TextureID, `Nodes[${node.ObjectId}].TextureID`);
  for (const node of model.RibbonEmitters || []) if (!model.Materials?.[node.MaterialID]) add('error', 'RIBBON_MATERIAL_REFERENCE', `Ribbon ${node.Name} references a missing material.`, `Nodes[${node.ObjectId}].MaterialID`);
  for (const [i, sequence] of (model.Sequences || []).entries()) if (!sequence.Interval || sequence.Interval.length !== 2 || sequence.Interval[0] >= sequence.Interval[1]) add('error', 'SEQUENCE_INTERVAL', `Sequence ${sequence.Name || i} must end after it starts.`, `Sequences[${i}]`);
  for (const [i, duration] of (model.GlobalSequences || []).entries()) if (!Number.isInteger(duration) || duration <= 0) add('error', 'GLOBAL_SEQUENCE_DURATION', `Global sequence ${i} needs a positive integer duration.`, `GlobalSequences[${i}]`);
  for (const event of model.EventObjects || []) if (event.GlobalSeqId != null && event.GlobalSeqId !== -1 && (!Number.isInteger(event.GlobalSeqId) || event.GlobalSeqId < 0 || model.GlobalSequences?.[event.GlobalSeqId] === undefined)) add('error', 'GLOBAL_SEQUENCE_REFERENCE', `Event ${event.Name} references missing global sequence ${event.GlobalSeqId}.`, `Nodes[${event.ObjectId}].GlobalSeqId`);
  const visited = new Set();
  function walk(value, path) {
    if (typeof value === 'number') { if (!Number.isFinite(value)) add('error', 'NON_FINITE_NUMBER', `${path} contains a non-finite number.`, path); return; }
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (ArrayBuffer.isView(value)) { if (value.some((n) => !Number.isFinite(n))) add('error', 'NON_FINITE_NUMBER', `${path} contains a non-finite coordinate.`, path); return; }
    if (value.Keys) {
      if (!Number.isInteger(value.LineType) || value.LineType < 0 || value.LineType > 3) add('error', 'KEYFRAME_INTERPOLATION', `${path} has an invalid interpolation mode.`, path);
      if (value.GlobalSeqId != null && value.GlobalSeqId !== -1 && model.GlobalSequences?.[value.GlobalSeqId] === undefined) add('error', 'GLOBAL_SEQUENCE_REFERENCE', `${path} references missing global sequence ${value.GlobalSeqId}.`, path);
      let previous = -Infinity;
      const property = path.split('.').at(-1);
      const width = property === 'Rotation' ? (path.includes('.Cameras.') ? 1 : 4) : ['Translation', 'Scaling', 'Color', 'AmbColor', 'FresnelColor', 'TargetTranslation'].includes(property) ? 3 : 1;
      for (const key of value.Keys) {
        if (!Number.isInteger(key.Frame) || key.Frame < -2147483648 || key.Frame > 2147483647 || key.Frame < previous) add('error', 'KEYFRAME_ORDER', `${path} keyframes must use signed 32-bit integer frames in increasing order.`, path);
        previous = key.Frame;
        if (!key.Vector?.length) add('error', 'KEYFRAME_VECTOR', `${path} has a keyframe without a value.`, path);
        else if (key.Vector.length !== width) add('error', 'KEYFRAME_DIMENSIONS', `${path} keyframes need ${width} values.`, path);
        if (value.LineType >= 2 && (!key.InTan || !key.OutTan || key.InTan.length !== key.Vector?.length || key.OutTan.length !== key.Vector?.length)) add('error', 'KEYFRAME_TANGENTS', `${path} spline keyframes need matching in/out tangents.`, path);
      }
    }
    for (const [key, val] of Object.entries(value)) if (key !== 'Nodes') walk(val, `${path}.${key}`);
  }
  walk(model, 'Model');
  return diagnostics;
}

export function createNode(model, type = 'Bone') {
  if (!NODE_TYPES[type]) throw new Error(`Unsupported node type: ${type}.`);
  if (model.BindPoses?.length) throw new Error('Adding nodes to a model with bind-pose matrices is not supported yet.');
  const [collection, , flags] = NODE_TYPES[type];
  const id = Math.max(-1, ...nodeCollections(model).map((n) => n.ObjectId), (model.PivotPoints?.length || 0) - 1) + 1;
  const pivot = V3();
  const node = { Name: `${type}_${id}`, ObjectId: id, Parent: null, PivotPoint: pivot, Flags: flags };
  if (type === 'Bone') Object.assign(node, { GeosetId: null, GeosetAnimId: null });
  if (type === 'Attachment') Object.assign(node, { AttachmentID: Math.max(-1, ...(model.Attachments || []).map((n) => n.AttachmentID || 0)) + 1, Path: '' });
  if (type === 'EventObject') node.EventTrack = new Uint32Array([0]);
  if (type === 'CollisionShape') Object.assign(node, { Shape: 2, Vertices: V3(), BoundsRadius: 16 });
  if (type === 'Light') Object.assign(node, { LightType: 0, AttenuationStart: 80, AttenuationEnd: 200, Color: rgbToWarcraftColor([0.2, 0.8, 1]), Intensity: 1, AmbColor: rgbToWarcraftColor([1, 1, 1]), AmbIntensity: 0 });
  if (type === 'ParticleEmitter2') Object.assign(node, {
    Speed: 10, Variation: 0, Latitude: 20, Gravity: 0, LifeSpan: 1, EmissionRate: 10, Width: 4, Length: 4,
    FilterMode: 1, Rows: 1, Columns: 1, FrameFlags: 1, TailLength: 0, Time: 0.5,
    SegmentColor: [[0.2, 0.7, 1], [0.3, 0.9, 1], [0.1, 0.3, 1]].map(rgbToWarcraftColor), Alpha: new Uint8Array([255, 200, 0]), ParticleScaling: V3(1, 1, 0),
    LifeSpanUVAnim: new Uint32Array([0, 0, 1]), DecayUVAnim: new Uint32Array([0, 0, 1]), TailUVAnim: new Uint32Array([0, 0, 1]), TailDecayUVAnim: new Uint32Array([0, 0, 1]),
    TextureID: model.Textures?.length ? 0 : null, ReplaceableId: 0, PriorityPlane: 0,
  });
  if (type === 'RibbonEmitter') {
    if (!model.Materials?.length) throw new Error('Create a material before adding a ribbon emitter.');
    Object.assign(node, { HeightAbove: 4, HeightBelow: 4, Alpha: 1, Color: rgbToWarcraftColor([0.3, 0.8, 1]), LifeSpan: 0.5, TextureSlot: 0, EmissionRate: 10, Rows: 1, Columns: 1, MaterialID: 0, Gravity: 0 });
  }
  if (type === 'ParticleEmitter') Object.assign(node, { EmissionRate: 10, Gravity: 0, Longitude: 0, Latitude: 0, Path: '', LifeSpan: 1, InitVelocity: 0 });
  if (type === 'ParticleEmitterPopcorn') {
    if (model.Version < 900) throw new Error('Popcorn emitters need a Reforged model version.');
    Object.assign(node, { LifeSpan: 1, EmissionRate: 0, Speed: 0, Color: V3(1, 1, 1), Alpha: 1, ReplaceableId: 0, Path: '', AnimVisibilityGuide: '' });
  }
  (model[collection] ||= []).push(node);
  (model.Nodes ||= [])[id] = node; (model.PivotPoints ||= [])[id] = pivot;
  updateCounts(model);
  return node;
}
export function deleteNode(model, id) {
  const node = nodeCollections(model).find((n) => n.ObjectId === id);
  if (!node) throw new Error(`Node ${id} does not exist.`);
  for (const [index, g] of (model.Geosets || []).entries()) {
    if ((g.Groups || []).some((group) => group.includes(id))) throw new Error(`Node ${id} is used by geoset ${index}. Reassign its matrix groups before deleting it.`);
    for (let i = 0; i < (g.SkinWeights?.length || 0); i += 8) for (let j = 0; j < 4; j++) if (g.SkinWeights[i + j] === id && g.SkinWeights[i + 4 + j]) throw new Error(`Node ${id} has weighted vertices in geoset ${index}. Reassign them before deleting it.`);
  }
  if (model.BindPoses?.length) throw new Error('Deleting nodes in a model with bind-pose matrices is not supported yet.');
  for (const child of nodeCollections(model)) if (child.Parent === id) child.Parent = node.Parent ?? null;
  for (const [collection] of Object.values(NODE_TYPES)) model[collection] = (model[collection] || []).filter((n) => n.ObjectId !== id);
  delete model.Nodes[id];
  model.PivotPoints[id] = V3();
  updateCounts(model);
  return node;
}
function updateCounts(model) {
  for (const [field, key] of Object.entries({ NumGeosets: 'Geosets', NumGeosetAnims: 'GeosetAnims', NumBones: 'Bones', NumHelpers: 'Helpers', NumLights: 'Lights', NumAttachments: 'Attachments', NumEvents: 'EventObjects', NumParticleEmitters: 'ParticleEmitters', NumParticleEmitters2: 'ParticleEmitters2', NumRibbonEmitters: 'RibbonEmitters' })) model.Info[field] = model[key]?.length || 0;
}
export function duplicateGeoset(model, index) {
  if (!model.Geosets?.[index]) throw new Error('Select an existing geoset to duplicate.');
  const geoset = clone(model.Geosets[index]);
  if (geoset.Name) geoset.Name += ' copy';
  const newIndex = model.Geosets.push(geoset) - 1;
  for (const anim of [...model.GeosetAnims]) if (anim.GeosetId === index) model.GeosetAnims.push({ ...clone(anim), GeosetId: newIndex });
  for (const bone of model.Bones || []) if (bone.GeosetId === index) bone.GeosetId = null;
  updateCounts(model);
  return newIndex;
}
export function deleteGeoset(model, index) {
  if (!model.Geosets?.[index]) throw new Error('Select an existing geoset to delete.');
  const animMap = new Map(); const anims = [];
  for (const [old, anim] of model.GeosetAnims.entries()) {
    if (anim.GeosetId === index) { animMap.set(old, null); continue; }
    animMap.set(old, anims.length);
    if (anim.GeosetId > index) anim.GeosetId--;
    anims.push(anim);
  }
  model.Geosets.splice(index, 1); model.GeosetAnims = anims;
  model.Gliders = (model.Gliders || []).filter(g=>g.GeosetId!==index).map(g=>({...g,GeosetId:g.GeosetId>index?g.GeosetId-1:g.GeosetId}));
  for (const bone of model.Bones || []) {
    if (bone.GeosetId === index) bone.GeosetId = null;
    else if (bone.GeosetId > index) bone.GeosetId--;
    if (bone.GeosetAnimId != null && bone.GeosetAnimId !== -1) bone.GeosetAnimId = animMap.get(bone.GeosetAnimId) ?? null;
  }
  updateCounts(model);
}

export function recalculateNormals(geoset) {
  const vertices = geoset.Vertices, faces = geoset.Faces;
  const normals = new Float32Array(vertices.length);
  for (let i = 0; i < faces.length; i += 3) {
    const a = faces[i] * 3, b = faces[i + 1] * 3, c = faces[i + 2] * 3;
    const ux = vertices[b] - vertices[a], uy = vertices[b + 1] - vertices[a + 1], uz = vertices[b + 2] - vertices[a + 2];
    const vx = vertices[c] - vertices[a], vy = vertices[c + 1] - vertices[a + 1], vz = vertices[c + 2] - vertices[a + 2];
    const normal = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    for (const offset of [a, b, c]) for (let k = 0; k < 3; k++) normals[offset + k] += normal[k];
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (length > 1e-12) for (let k = 0; k < 3; k++) normals[i + k] /= length;
    else normals[i + 2] = 1;
  }
  geoset.Normals = normals;
  return normals;
}
function bounds(vertices) {
  const min = V3(Infinity, Infinity, Infinity), max = V3(-Infinity, -Infinity, -Infinity);
  if (!vertices.length) return { MinimumExtent: V3(), MaximumExtent: V3(), BoundsRadius: 0 };
  for (let i = 0; i < vertices.length; i++) { const k = i % 3; min[k] = Math.min(min[k], vertices[i]); max[k] = Math.max(max[k], vertices[i]); }
  const center = min.map((v, i) => (v + max[i]) / 2); let radius = 0;
  for (let i = 0; i < vertices.length; i += 3) radius = Math.max(radius, Math.hypot(vertices[i] - center[0], vertices[i + 1] - center[1], vertices[i + 2] - center[2]));
  return { MinimumExtent: min, MaximumExtent: max, BoundsRadius: radius };
}
export function recalculateExtents(model) {
  const min = V3(Infinity, Infinity, Infinity), max = V3(-Infinity, -Infinity, -Infinity);
  for (const g of model.Geosets || []) {
    Object.assign(g, bounds(g.Vertices));
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], g.MinimumExtent[k]); max[k] = Math.max(max[k], g.MaximumExtent[k]); }
  }
  const vertices = model.Geosets?.length ? new Float32Array([...min, ...max]) : new Float32Array();
  Object.assign(model.Info, bounds(vertices));
  // Existing animation bounds are intentionally retained; bind-pose geometry is
  // insufficient to compute their animated swept bounds.
  return model.Info;
}
/** Rotation is Euler XYZ in degrees, about the model origin. */
export function transformGeoset(geoset, { translation = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  if (typeof scale === 'number') scale = [scale, scale, scale];
  for (const value of [translation, rotation, scale]) if (value.length !== 3 || [...value].some((n) => !Number.isFinite(n))) throw new Error('Transforms need three finite values per vector.');
  if (scale.some((n) => Math.abs(n) < 1e-8)) throw new Error('Scale cannot be zero.');
  const angles = rotation.map((v) => v * Math.PI / 180);
  const [sx, sy, sz] = angles.map(Math.sin), [cx, cy, cz] = angles.map(Math.cos);
  const rotate = (x, y, z) => {
    [y, z] = [y * cx - z * sx, y * sx + z * cx];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    return [x * cz - y * sz, x * sz + y * cz, z];
  };
  for (let i = 0; i < geoset.Vertices.length; i += 3) {
    const value = rotate(geoset.Vertices[i] * scale[0], geoset.Vertices[i + 1] * scale[1], geoset.Vertices[i + 2] * scale[2]);
    for (let k = 0; k < 3; k++) geoset.Vertices[i + k] = value[k] + translation[k];
    const normal = rotate(geoset.Normals[i] / scale[0], geoset.Normals[i + 1] / scale[1], geoset.Normals[i + 2] / scale[2]);
    const length = Math.hypot(...normal) || 1;
    for (let k = 0; k < 3; k++) geoset.Normals[i + k] = normal[k] / length;
  }
  if (geoset.Tangents?.length) for (let i = 0; i < geoset.Tangents.length; i += 4) {
    const tangent = rotate(geoset.Tangents[i] * scale[0], geoset.Tangents[i + 1] * scale[1], geoset.Tangents[i + 2] * scale[2]);
    const length = Math.hypot(...tangent) || 1;
    for (let k = 0; k < 3; k++) geoset.Tangents[i + k] = tangent[k] / length;
    if (scale[0] * scale[1] * scale[2] < 0) geoset.Tangents[i + 3] *= -1;
  }
  if (scale[0] * scale[1] * scale[2] < 0) for (let i = 0; i < geoset.Faces.length; i += 3) [geoset.Faces[i + 1], geoset.Faces[i + 2]] = [geoset.Faces[i + 2], geoset.Faces[i + 1]];
  Object.assign(geoset, bounds(geoset.Vertices));
  return geoset;
}

function appendGeosetGeometry(target, source) {
  const targetCount = target.Vertices.length / 3, sourceCount = source.Vertices.length / 3;
  if (targetCount + sourceCount > 65536) throw new Error('Pasted geometry would exceed the geoset 16-bit vertex limit.');
  if (target.TVertices.length !== source.TVertices.length) throw new Error('Pasted geometry must have the same UV set count as its destination geoset.');
  if (!!target.Tangents?.length !== !!source.Tangents?.length) throw new Error('Pasted geometry must use the same tangent format as its destination geoset.');
  if (!!target.SkinWeights?.length !== !!source.SkinWeights?.length) throw new Error('Pasted geometry must use the same skin-weight format as its destination geoset.');

  const append = (left, right) => {
    const output = new left.constructor(left.length + right.length);
    output.set(left); output.set(right, left.length);
    return output;
  };
  const groups = target.Groups.map((group) => [...group]);
  const vertexGroups = new target.VertexGroup.constructor(source.VertexGroup.length);
  for (let vertex = 0; vertex < source.VertexGroup.length; vertex++) {
    const sourceGroup = source.Groups[source.VertexGroup[vertex]];
    if (!sourceGroup) throw new Error('Pasted geometry references a missing matrix group.');
    let mapped = groups.findIndex((group) => group.length === sourceGroup.length && group.every((id, index) => id === sourceGroup[index]));
    if (mapped < 0) mapped = groups.push([...sourceGroup]) - 1;
    if (mapped > 255) throw new Error('Pasted geometry would exceed the geoset matrix-group limit.');
    vertexGroups[vertex] = mapped;
  }
  const faces = new target.Faces.constructor(target.Faces.length + source.Faces.length);
  faces.set(target.Faces);
  for (let index = 0; index < source.Faces.length; index++) faces[target.Faces.length + index] = source.Faces[index] + targetCount;

  target.Vertices = append(target.Vertices, source.Vertices);
  target.Normals = append(target.Normals, source.Normals);
  target.Faces = faces;
  target.TVertices = target.TVertices.map((values, index) => append(values, source.TVertices[index]));
  target.VertexGroup = append(target.VertexGroup, vertexGroups);
  target.Groups = groups;
  target.TotalGroupsCount = groups.reduce((total, group) => total + group.length, 0);
  if (target.Tangents?.length) target.Tangents = append(target.Tangents, source.Tangents);
  if (target.SkinWeights?.length) target.SkinWeights = append(target.SkinWeights, source.SkinWeights);
  Object.assign(target, bounds(target.Vertices));
  return Array.from({ length: sourceCount }, (_, index) => targetCount + index);
}

/** Append selected geometry with its required rig, textures and animation dependencies. */
export function importGeosets(target, source, selectedIndices = source.Geosets.map((_, i) => i), anchor = null, { sameModel = false, targetGeoset = null } = {}) {
  if (source.Version !== target.Version) throw new Error('Geoset import currently requires matching format versions to preserve SD/HD data.');
  if (source.BindPoses?.length || target.BindPoses?.length) throw new Error('Geoset import with bind-pose matrices is not supported yet.');
  if (anchor && typeof anchor === 'object') anchor = anchor.ObjectId;
  if (anchor != null && !target.Nodes?.[anchor]) throw new Error('The destination anchor node does not exist.');
  const reuseExisting = sameModel && anchor == null;
  const indices = [...new Set(selectedIndices)];
  if (!indices.length) return { geosetIndices: [], selection: {}, nodeMap: {}, materialMap: {}, textureMap: {}, warnings: [] };
  for (const index of indices) if (!source.Geosets?.[index]) throw new Error(`Source geoset ${index} does not exist.`);
  const neededNodes = new Set(); const visiting = new Set();
  function requireNode(id) {
    if (neededNodes.has(id)) return;
    if (visiting.has(id)) throw new Error('Source hierarchy contains a cycle.');
    const node = source.Nodes?.[id]; if (!node) throw new Error(`Source rig references missing node ${id}.`);
    visiting.add(id);
    if (node.Parent != null && node.Parent !== -1) requireNode(node.Parent);
    visiting.delete(id); neededNodes.add(id);
  }
  for (const index of indices) {
    const g = source.Geosets[index];
    for (const id of (g.Groups || []).flat()) requireNode(id);
    for (let i = 0; i < (g.SkinWeights?.length || 0); i += 8) for (let k = 0; k < 4; k++) if (g.SkinWeights[i + 4 + k]) requireNode(g.SkinWeights[i + k]);
  }
  const maps = { textures: new Map(), materials: new Map(), textureAnims: new Map(), globals: new Map(), nodes: new Map(), geosets: new Map(), geosetAnims: new Map() };
  const createdNodes = new Set(), createdGeosets = new Set(), selections = new Map();
  const globalRef = (value) => {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
    if (value.GlobalSeqId != null && value.GlobalSeqId !== -1) {
      const old = value.GlobalSeqId;
      if (!maps.globals.has(old)) { if (source.GlobalSequences[old] === undefined) throw new Error('Source track references a missing global sequence.'); maps.globals.set(old, target.GlobalSequences.push(source.GlobalSequences[old]) - 1); }
      value.GlobalSeqId = maps.globals.get(old);
    }
    for (const child of Object.values(value)) globalRef(child);
  };
  const textureRef = (old) => {
    if (old == null || old === -1) return old;
    if (!source.Textures[old]) throw new Error(`Source material references missing texture ${old}.`);
    if (!maps.textures.has(old)) {
      const sourceTexture = source.Textures[old]; const existing = target.Textures.findIndex((t) => fingerprint(t) === fingerprint(sourceTexture));
      maps.textures.set(old, existing >= 0 ? existing : target.Textures.push(clone(sourceTexture)) - 1);
    }
    return maps.textures.get(old);
  };
  const materialRef = (old) => {
    if (!source.Materials[old]) throw new Error(`Source geoset references missing material ${old}.`);
    if (!maps.materials.has(old)) {
      if (reuseExisting) {
        const original = fingerprint(target.Materials[old]) === fingerprint(source.Materials[old]) ? old : -1;
        const existing = original >= 0 ? original : target.Materials.findIndex((material) => fingerprint(material) === fingerprint(source.Materials[old]));
        if (existing >= 0) { maps.materials.set(old, existing); return existing; }
      }
      const material = clone(source.Materials[old]);
      for (const layer of material.Layers) {
        for (const slot of TEXTURE_SLOTS) if (typeof layer[slot] === 'number') layer[slot] = textureRef(layer[slot]);
        else if (layer[slot]?.Keys) for (const key of layer[slot].Keys) { key.Vector = new Int32Array([...key.Vector].map(textureRef)); if (key.InTan) key.InTan = new Int32Array([...key.InTan].map(textureRef)); if (key.OutTan) key.OutTan = new Int32Array([...key.OutTan].map(textureRef)); }
        for (const slot of TEXTURE_SLOTS) if (typeof layer._MdxDefaults?.[slot] === 'number') layer._MdxDefaults[slot] = textureRef(layer._MdxDefaults[slot]);
        const texAnim = layer.TVertexAnimId;
        if (texAnim != null && texAnim !== -1) {
          if (!source.TextureAnims[texAnim]) throw new Error('Source material references a missing texture animation.');
          if (!maps.textureAnims.has(texAnim)) { const animation = clone(source.TextureAnims[texAnim]); globalRef(animation); maps.textureAnims.set(texAnim, target.TextureAnims.push(animation) - 1); }
          layer.TVertexAnimId = maps.textureAnims.get(texAnim);
        }
      }
      globalRef(material); maps.materials.set(old, target.Materials.push(material) - 1);
    }
    return maps.materials.get(old);
  };
  for (const id of neededNodes) {
    if (reuseExisting) {
      if (!target.Nodes?.[id]) throw new Error(`The original pasted bone or node ${id} no longer exists in this model.`);
      maps.nodes.set(id, id);
      continue;
    }
    const original = source.Nodes[id];
    const type = Object.keys(NODE_TYPES).find((name) => source[NODE_TYPES[name][0]]?.some((n) => n.ObjectId === id));
    const created = createNode(target, type);
    maps.nodes.set(id, created.ObjectId);
    createdNodes.add(id);
    const newID = created.ObjectId;
    Object.assign(created, clone(original), { ObjectId: newID, Parent: original.Parent == null || original.Parent === -1 ? anchor : maps.nodes.get(original.Parent), Name: `${original.Name}_import` });
    created.PivotPoint = clone(source.PivotPoints[id] || original.PivotPoint || V3()); target.PivotPoints[newID] = created.PivotPoint;
    if (type === 'Bone') { created.GeosetId = null; created.GeosetAnimId = null; }
    if (type === 'ParticleEmitter2') created.TextureID = textureRef(created.TextureID);
    if (type === 'RibbonEmitter') created.MaterialID = materialRef(created.MaterialID);
    globalRef(created);
  }
  for (const index of indices) {
    const g = clone(source.Geosets[index]);
    g.MaterialID = materialRef(g.MaterialID);
    g.Groups = g.Groups.map((group) => group.map((id) => maps.nodes.get(id)));
    for (let i = 0; i < (g.SkinWeights?.length || 0); i += 8) for (let k = 0; k < 4; k++) {
      if (g.SkinWeights[i + 4 + k]) {
        const mapped = maps.nodes.get(g.SkinWeights[i + k]);
        if (mapped > (target.Version >= 1400 ? 65535 : 255)) throw new Error('Imported weighted skin would exceed the format bone-index capacity.');
        g.SkinWeights[i + k] = mapped;
      } else g.SkinWeights[i + k] = 0;
    }
    const requestedTarget = indices.length === 1 && Number.isInteger(targetGeoset) && targetGeoset >= 0 ? targetGeoset : index;
    const destination = reuseExisting && target.Geosets[requestedTarget]?.MaterialID === g.MaterialID ? requestedTarget : null;
    if (destination != null) {
      const added = appendGeosetGeometry(target.Geosets[destination], g);
      maps.geosets.set(index, destination);
      selections.set(destination, [...(selections.get(destination) || []), ...added]);
    } else {
      const added = target.Geosets.push(g) - 1;
      maps.geosets.set(index, added); createdGeosets.add(index);
      selections.set(added, Array.from({ length: g.Vertices.length / 3 }, (_, vertex) => vertex));
    }
  }
  for (const [index, anim] of source.GeosetAnims.entries()) if (createdGeosets.has(anim.GeosetId)) {
    const copy = clone(anim); copy.GeosetId = maps.geosets.get(anim.GeosetId); globalRef(copy);
    maps.geosetAnims.set(index, target.GeosetAnims.push(copy) - 1);
  }
  for (const old of createdNodes) {
    const id = maps.nodes.get(old);
    const original = source.Nodes[old], node = target.Nodes[id];
    if ('GeosetId' in original) node.GeosetId = maps.geosets.get(original.GeosetId) ?? null;
    if ('GeosetAnimId' in original) node.GeosetAnimId = maps.geosetAnims.get(original.GeosetAnimId) ?? null;
  }
  normalizeModel(target); updateCounts(target); recalculateExtents(target);
  const warnings = reuseExisting && !maps.textureAnims.size ? [] : ['Imported animation keys retain their source frame times. Destination sequence definitions are unchanged; align intervals when needed.'];
  if (anchor != null) warnings.push('Imported roots are parented to the anchor; its transforms now affect the imported rig.');
  return { geosetIndices: [...new Set(maps.geosets.values())], selection: Object.fromEntries(selections), nodeMap: Object.fromEntries(maps.nodes), materialMap: Object.fromEntries(maps.materials), textureMap: Object.fromEntries(maps.textures), warnings };
}

function makeGeoset(vertices, faces, material, bone = 0) {
  const geoset = {
    Vertices: new Float32Array(vertices), Faces: new Uint16Array(faces), Normals: new Float32Array(vertices.length),
    TVertices: [new Float32Array(vertices.length / 3 * 2)], VertexGroup: new Uint8Array(vertices.length / 3), Groups: [[bone]], TotalGroupsCount: 1,
    ...bounds(vertices), Anims: [], MaterialID: material, SelectionGroup: 0, Unselectable: false,
  };
  for (let i = 0; i < vertices.length / 3; i++) { geoset.TVertices[0][i * 2] = (vertices[i * 3] + 50) / 100; geoset.TVertices[0][i * 2 + 1] = vertices[i * 3 + 2] / 200; }
  recalculateNormals(geoset); return geoset;
}
function prism(outline, depth, material, bone = 0) {
  const vertices = [], faces = [], n = outline.length;
  for (const y of [-depth / 2, depth / 2]) for (const [x, z] of outline) vertices.push(x, y, z);
  // Convex outlines are ordered counterclockwise in X/Z space.
  for (let i = 1; i < n - 1; i++) faces.push(0, i, i + 1, n, n + i + 1, n + i);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push(i, j + n, j, i, i + n, j + n); }
  return makeGeoset(vertices, faces, material, bone);
}
export function createDemoDocument() {
  const model = emptyModel(800, 'Aether Runeblade');
  model.Textures = [{ Image: '', ReplaceableId: 1, Flags: 0 }];
  model.Materials = [
    { PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 0, Shading: 16, TextureID: 0, TVertexAnimId: null, CoordId: 0, Alpha: 1 }] },
    { PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 0, Shading: 16, TextureID: 0, TVertexAnimId: null, CoordId: 0, Alpha: 1 }] },
    { PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 0, Shading: 16, TextureID: 0, TVertexAnimId: null, CoordId: 0, Alpha: 1 }] },
    { PriorityPlane: 1, RenderMode: 0, Layers: [{ FilterMode: 3, Shading: 17, TextureID: 0, TVertexAnimId: null, CoordId: 0, Alpha: 1 }] },
  ];
  const root = createNode(model, 'Bone'); root.Name = 'Blade_Root'; root.PivotPoint[2] = 80;
  root.Translation = { LineType: 1, Keys: [0, 1000, 2000].map((Frame, i) => ({ Frame, Vector: V3(0, 0, i === 1 ? 8 : 0) })) };
  root.Rotation = { LineType: 1, Keys: [0, 1000, 2000].map((Frame, i) => ({ Frame, Vector: new Float32Array([0, 0, Math.sin((i === 1 ? 0.08 : -0.08) / 2), Math.cos(0.08 / 2)]) })) };
  const rune = createNode(model, 'Bone'); rune.Name = 'Rune_Core'; rune.Parent = root.ObjectId; rune.PivotPoint[2] = 128;
  const attachment = createNode(model, 'Attachment'); attachment.Name = 'weapon'; attachment.Parent = root.ObjectId; attachment.PivotPoint[2] = 46;
  model.Geosets = [
    prism([[-11, 74], [11, 74], [15, 112], [9, 157], [0, 193], [-9, 157], [-15, 112]], 5, 0),
    prism([[-48, 69], [-38, 59], [0, 70], [38, 59], [48, 69], [0, 82]], 10, 1),
    prism([[-6, 30], [6, 30], [6, 69], [-6, 69]], 9, 2),
    prism([[-10, 24], [0, 15], [10, 24], [0, 36]], 10, 1),
    prism([[0, 104], [5, 127], [0, 151], [-5, 127]], 5.6, 3, rune.ObjectId),
  ];
  const colors = [[0.70, 0.82, 0.92], [0.70, 0.44, 0.12], [0.15, 0.18, 0.25], [0.78, 0.52, 0.16], [0.16, 0.82, 1]];
  model.GeosetAnims = model.Geosets.map((_, i) => ({ GeosetId: i, Alpha: i === 4 ? { LineType: 1, Keys: [0, 1000, 2000].map((Frame, k) => ({ Frame, Vector: new Float32Array([k === 1 ? 0.5 : 1]) })) } : 1, Color: rgbToWarcraftColor(colors[i]), Flags: 2 }));
  recalculateExtents(model);
  const extent = { MinimumExtent: V3(-58, -20, 5), MaximumExtent: V3(58, 20, 211), BoundsRadius: 124 };
  model.Sequences = [{ Name: 'Stand', Interval: new Uint32Array([0, 2000]), NonLooping: false, MoveSpeed: 0, Rarity: 0, ...clone(extent) }];
  for (const g of model.Geosets) g.Anims = [clone(extent)];
  updateCounts(model);
  normalizeModel(model);
  const source = '// MDLVis Modern — original synthetic demonstration model.\n// Free to edit and redistribute. No Blizzard assets are included.\n' + generateMDL(model);
  return openDocument(source, 'Aether-Runeblade.mdl');
}
