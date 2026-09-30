import { allNodes } from './animation.js';

export const HELPER_LIST_COLOR = '#8a2be2';

const REGION_ORDER = Object.freeze({ chest: 0, armRight: 1, armLeft: 2, arm: 3, legRight: 4, legLeft: 5, leg: 6, head: 7, pelvis: 8, other: 9 });
const NAME_WEIGHTS = [6, 5, 3, 2, 1];

function words(value) {
  const spaced = String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return { spaced, compact: spaced.replace(/\s+/g, ''), tokens: spaced ? spaced.split(/\s+/) : [] };
}

function nameRegion(text) {
  const { spaced, compact } = text;
  if (/\b(chest|torso|spine|ribcage|breast|upper body)\b/.test(spaced) || /upperbody/.test(compact)) return 'chest';
  if (/\b(arm|shoulder|clavicle|elbow|forearm|wrist|hand|finger|thumb)\b/.test(spaced) || /(arm|shoulder|elbow|forearm|wrist|hand|finger|thumb)/.test(compact)) return 'arm';
  if (/\b(leg|thigh|knee|calf|shin|ankle|foot|toe)\b/.test(spaced) || /(leg|thigh|knee|calf|shin|ankle|foot|toe)/.test(compact)) return 'leg';
  if (/\b(head|neck|face|jaw|mouth|eye|brow|cheek|nose|ear)\b/.test(spaced) || /(head|neck|face|jaw|mouth|eye|brow|cheek|nose|ear)/.test(compact)) return 'head';
  if (/\b(root|pelvis|hip|waist|abdomen|belly|gut|gutz)\b/.test(spaced) || /(pelvis|abdomen|belly|gutz)/.test(compact)) return 'pelvis';
  if (/\b(mesh|object|box|dummy|chain|ribbon|reference|ref|copied|backdrop)\b/.test(spaced) || /(copiedmodeldummy|portraitbackdrop)/.test(compact)) return 'other';
  return null;
}

function nameSide(text) {
  const { tokens, compact } = text;
  if (tokens.includes('right') || tokens.includes('r') || /(?:arm|leg|hand|foot|shoulder|wrist|thigh|knee|toe)r\d*$/.test(compact) || /^r(?:arm|leg|hand|foot|shoulder|wrist|thigh|knee|toe)/.test(compact)) return 'right';
  if (tokens.includes('left') || tokens.includes('l') || /(?:arm|leg|hand|foot|shoulder|wrist|thigh|knee|toe)l\d*$/.test(compact) || /^l(?:arm|leg|hand|foot|shoulder|wrist|thigh|knee|toe)/.test(compact)) return 'left';
  return null;
}

function nameSegment(text, region) {
  const { spaced, compact, tokens } = text;
  const number = tokens.map(Number).find(value => Number.isInteger(value) && value >= 0 && value < 100);
  if (region === 'arm') {
    if (/\b(clavicle|shoulder)\b/.test(spaced)) return 0;
    if (number !== undefined && /arm/.test(compact)) return number;
    if (/\b(upper arm|upperarm)\b/.test(spaced)) return 1;
    if (/\b(elbow|forearm)\b/.test(spaced)) return 2;
    if (/\bwrist\b/.test(spaced)) return 3;
    if (/\bhand\b/.test(spaced)) return 4;
    if (/\b(finger|thumb)\b/.test(spaced)) return 5;
  }
  if (region === 'leg') {
    if (/\b(hip|thigh)\b/.test(spaced)) return 0;
    if (number !== undefined && /leg/.test(compact)) return number;
    if (/\b(knee|calf|shin)\b/.test(spaced)) return 2;
    if (/\bankle\b/.test(spaced)) return 3;
    if (/\bfoot\b/.test(spaced)) return 4;
    if (/\btoe\b/.test(spaced)) return 5;
  }
  if (region === 'head') {
    if (/\bneck\b/.test(spaced)) return 0;
    if (/\bhead\b/.test(spaced)) return 1;
    if (/\b(face|eye|brow|cheek|nose|ear)\b/.test(spaced)) return 2;
    if (/\b(mouth|jaw)\b/.test(spaced)) return 3;
  }
  if (region === 'pelvis') {
    if (/\broot\b/.test(spaced)) return 0;
    if (/\bpelvis\b/.test(spaced)) return 1;
    if (/\b(hip|waist)\b/.test(spaced)) return 2;
    if (/\b(abdomen|belly|gut|gutz)\b/.test(spaced)) return 3;
  }
  if (region === 'chest') {
    if (number !== undefined && /spine/.test(compact)) return number;
    return 0;
  }
  return null;
}

function quantile(values, amount) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b), position = (sorted.length - 1) * amount;
  const low = Math.floor(position), high = Math.ceil(position), mix = position - low;
  return sorted[low] * (1 - mix) + sorted[high] * mix;
}

function pivot(node) {
  const values = node?.PivotPoint;
  return values?.length >= 3 && Array.from(values).every(Number.isFinite) ? [Number(values[0]), Number(values[1]), Number(values[2])] : [0, 0, 0];
}

function layoutEvidence(nodes) {
  const points = nodes.map(pivot), axes = [0, 1].map(axis => ({ axis, values: points.map(point => point[axis]) }));
  const zValues = points.map(point => point[2]), zLow = quantile(zValues, .1), zHigh = quantile(zValues, .9), zRange = Math.max(1e-6, zHigh - zLow);
  const named = nodes.map(node => ({ node, side: nameSide(words(node.Name)), point: pivot(node) })).filter(item => item.side);
  let lateralAxis = 1;
  if (named.some(item => item.side === 'right') && named.some(item => item.side === 'left')) {
    lateralAxis = axes.map(({ axis, values }) => {
      const right = named.filter(item => item.side === 'right').map(item => item.point[axis]);
      const left = named.filter(item => item.side === 'left').map(item => item.point[axis]);
      const spread = Math.max(1e-6, quantile(values, .9) - quantile(values, .1));
      return { axis, separation: Math.abs(right.reduce((sum, value) => sum + value, 0) / right.length - left.reduce((sum, value) => sum + value, 0) / left.length) / spread };
    }).sort((a, b) => b.separation - a.separation)[0].axis;
  }
  const lateralValues = points.map(point => point[lateralAxis]), lateralCenter = quantile(lateralValues, .5);
  const lateralRange = Math.max(1e-6, quantile(lateralValues, .9) - quantile(lateralValues, .1));
  const rightValues = named.filter(item => item.side === 'right').map(item => item.point[lateralAxis]);
  const leftValues = named.filter(item => item.side === 'left').map(item => item.point[lateralAxis]);
  const rightSign = rightValues.length && leftValues.length
    ? Math.sign(rightValues.reduce((sum, value) => sum + value, 0) / rightValues.length - leftValues.reduce((sum, value) => sum + value, 0) / leftValues.length) || -1
    : -1;
  return { lateralAxis, lateralCenter, lateralRange, rightSign, zLow, zRange };
}

function directInfluences(model) {
  const counts = new Map();
  for (const geoset of model.Geosets || []) {
    const count = Math.floor((geoset.Vertices?.length || 0) / 3), skin = geoset.SkinWeights;
    for (let vertex = 0; vertex < count; vertex++) {
      const ids = skin?.length === count * 8
        ? [0, 1, 2, 3].filter(slot => skin[vertex * 8 + 4 + slot] > 0).map(slot => skin[vertex * 8 + slot])
        : geoset.Groups?.[geoset.VertexGroup?.[vertex]] || [];
      for (const id of new Set(ids)) counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return counts;
}

function sideRegion(region, side) {
  if (region === 'arm' && side) return side === 'right' ? 'armRight' : 'armLeft';
  if (region === 'leg' && side) return side === 'right' ? 'legRight' : 'legLeft';
  return region;
}

function analyze(model) {
  const nodes = allNodes(model), byId = new Map(nodes.map(node => [node.ObjectId, node])), children = new Map();
  for (const node of nodes) { const list = children.get(node.Parent) || []; list.push(node); children.set(node.Parent, list); }
  const layout = layoutEvidence([...(model.Bones || []), ...(model.Helpers || [])]), direct = directInfluences(model), evidence = new Map();
  const branchInfluence = (id, visiting = new Set()) => {
    if (visiting.has(id)) return direct.get(id) || 0;
    const next = new Set(visiting).add(id);
    return (direct.get(id) || 0) + (children.get(id) || []).reduce((sum, child) => sum + branchInfluence(child.ObjectId, next), 0);
  };
  const hierarchyDepth = node => {
    let depth = 0, current = node, seen = new Set([node.ObjectId]);
    while ((current = byId.get(current.Parent)) && !seen.has(current.ObjectId)) { seen.add(current.ObjectId); depth++; }
    return depth;
  };
  for (const node of nodes) {
    const regionScores = { chest: 0, arm: 0, leg: 0, head: 0, pelvis: 0, other: 0 }, sideScores = { right: 0, left: 0 }, segments = [];
    let current = node;
    for (let distance = 0; current && distance < NAME_WEIGHTS.length; distance++, current = byId.get(current.Parent)) {
      const text = words(current.Name), region = nameRegion(text), side = nameSide(text), weight = NAME_WEIGHTS[distance];
      if (region) { regionScores[region] += region === 'other' ? weight * .4 : weight; const segment = nameSegment(text, region); if (segment != null) segments.push({ region, segment, distance }); }
      if (side) sideScores[side] += weight;
    }
    for (const child of children.get(node.ObjectId) || []) {
      const text = words(child.Name), region = nameRegion(text), side = nameSide(text);
      if (region) regionScores[region] += 1;
      if (side) sideScores[side] += 1;
    }
    const point = pivot(node), z = Math.max(0, Math.min(1, (point[2] - layout.zLow) / layout.zRange));
    const lateral = (point[layout.lateralAxis] - layout.lateralCenter) / layout.lateralRange, distance = Math.abs(lateral);
    if (z >= .68) regionScores[distance >= .18 ? 'arm' : 'head'] += 2;
    else if (z <= .38) regionScores.leg += 2;
    else if (distance >= .28) regionScores.arm += 2;
    else regionScores.chest += 1.5;
    if (distance >= .08) sideScores[Math.sign(lateral) === layout.rightSign ? 'right' : 'left'] += 2;
    const region = Object.entries(regionScores).sort((a, b) => b[1] - a[1] || REGION_ORDER[a[0]] - REGION_ORDER[b[0]])[0][0];
    const side = sideScores.right === sideScores.left ? null : sideScores.right > sideScores.left ? 'right' : 'left';
    const namedSegment = segments.filter(item => item.region === region).sort((a, b) => a.distance - b.distance || a.segment - b.segment)[0];
    const geometricSegment = region === 'arm' ? 50 + Math.round(distance * 20) : region === 'leg' ? 50 + Math.round((1 - z) * 20) : 50;
    const resolvedRegion = sideRegion(region, side);
    evidence.set(node.ObjectId, {
      region: resolvedRegion, rank: REGION_ORDER[resolvedRegion], segment: namedSegment?.segment ?? geometricSegment,
      depth: hierarchyDepth(node), directInfluence: direct.get(node.ObjectId) || 0, branchInfluence: branchInfluence(node.ObjectId),
    });
  }
  const compare = (left, right) => {
    const a = evidence.get(left.ObjectId), b = evidence.get(right.ObjectId);
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.segment !== b.segment) return a.segment - b.segment;
    if (a.depth !== b.depth) return a.depth - b.depth;
    if (!!a.directInfluence !== !!b.directInfluence) return a.directInfluence ? -1 : 1;
    if (a.directInfluence !== b.directInfluence) return b.directInfluence - a.directInfluence;
    if (a.branchInfluence !== b.branchInfluence) return b.branchInfluence - a.branchInfluence;
    return left.ObjectId - right.ObjectId;
  };
  return { nodes, compare };
}

/**
 * Bones and Helpers are deliberately separate. Anatomical order combines node
 * names, hierarchy context, pivot layout and real vertex influence without
 * changing ObjectIds or any model data.
 */
export function rigNodeListGroups(model) {
  const { nodes, compare } = analyze(model), bones = new Set((model.Bones || []).map(node => node.ObjectId)), helpers = new Set((model.Helpers || []).map(node => node.ObjectId));
  return {
    bones: nodes.filter(node => bones.has(node.ObjectId)).sort(compare),
    others: nodes.filter(node => !bones.has(node.ObjectId) && !helpers.has(node.ObjectId)).sort((a, b) => a.ObjectId - b.ObjectId),
    helpers: nodes.filter(node => helpers.has(node.ObjectId)).sort(compare),
  };
}

export function rigNodeListKind(model, node) {
  if (!node) return null;
  if ((model.Bones || []).some(item => item.ObjectId === node.ObjectId)) return 'bone';
  if ((model.Helpers || []).some(item => item.ObjectId === node.ObjectId)) return 'helper';
  return 'other';
}
