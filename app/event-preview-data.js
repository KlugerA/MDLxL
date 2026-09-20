// Warcraft table fields and name conventions are documented by the upstream viewer:
// https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/viewer/handlers/mdx/handler.ts
// https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/viewer/handlers/mdx/eventobjectemitterobject.ts
// This module only evaluates authored events; it does not substitute placeholder effects.
export const EVENT_TABLE_PATHS = Object.freeze({ SPN: 'Splats\\SpawnData.slk', SPL: 'Splats\\SplatData.slk', UBR: 'Splats\\UberSplatData.slk' });
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const norm = value => String(value || '').replace(/\//g, '\\').toLowerCase();

export function parseEventName(name) {
  name = String(name || '');
  let type = name.slice(0, 3).toUpperCase();
  if (type === 'FPT') type = 'SPL';
  const id = name.slice(4);
  return EVENT_TABLE_PATHS[type] && id ? { type, id, tablePath: EVENT_TABLE_PATHS[type] } : null;
}

function slkFields(line) {
  const fields = []; let current = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      current += char;
      if (quoted && line[i + 1] === '"') { current += line[++i]; continue; }
      quoted = !quoted;
    } else if (char === ';' && !quoted) { fields.push(current); current = ''; }
    else current += char;
  }
  fields.push(current); return fields;
}

/** Read SYLK cell records, retaining omitted coordinates and quoted delimiters. */
export function parseSlk(text) {
  const cells = new Map(); let x = 1, y = 1;
  for (const line of String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const fields = slkFields(line);
    if (fields[0] !== 'C') continue;
    let value;
    for (const field of fields.slice(1)) {
      if (/^X\d+$/.test(field)) x = Number(field.slice(1));
      else if (/^Y\d+$/.test(field)) y = Number(field.slice(1));
      else if (field.startsWith('K')) {
        const raw = field.slice(1);
        value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1).replace(/""/g, '"') : /^[-+]?\d+(?:\.\d*)?(?:e[-+]?\d+)?$/i.test(raw) ? Number(raw) : raw;
      }
    }
    if (value !== undefined && Number.isInteger(x) && Number.isInteger(y) && x > 0 && y > 0) {
      if (!cells.has(y)) cells.set(y, new Map());
      cells.get(y).set(x, value);
    }
  }
  const rows = new Map(), header = cells.get(1);
  if (!header) return rows;
  for (const [rowIndex, fields] of cells) {
    if (rowIndex === 1 || !fields.has(1)) continue;
    const row = Object.create(null);
    for (const [column, value] of fields) if (header.has(column)) row[String(header.get(column))] = value;
    rows.set(String(fields.get(1)), row);
  }
  return rows;
}

export function resolveEventDefinition(name, tables, { textureExtension = 'blp' } = {}) {
  const event = parseEventName(name);
  if (!event) return null;
  const sources = tables instanceof Map ? [...tables.entries()] : Object.entries(tables || {});
  let table = sources.find(([key]) => key === event.type || norm(key) === norm(event.tablePath))?.[1];
  if (typeof table === 'string') table = parseSlk(table);
  const entries = table instanceof Map ? [...table.entries()] : Object.entries(table || {});
  const row = entries.find(([key]) => key.toLowerCase() === event.id.toLowerCase())?.[1];
  if (!row) return null;
  const fields = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
  const string = key => String(fields.get(key.toLowerCase()) ?? '').trim();
  const number = (key, fallback = 0) => { const value = fields.get(key.toLowerCase()); return value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : fallback; };
  if (event.type === 'SPN') {
    const path = string('Model');
    return path && path !== '_' ? { ...event, resourcePath: path.replace(/\.mdl$/i, '.mdx'), lifeSpanMs: 0 } : null;
  }
  const file = string('file');
  if (!file || file === '_') return null;
  const colors = ['Start', 'Middle', 'End'].map(stage => ['R', 'G', 'B', 'A'].map(channel => clamp(number(stage + channel, 255), 0, 255) / 255));
  const intervalTimesMs = (event.type === 'SPL' ? ['Lifespan', 'Decay'] : ['BirthTime', 'PauseTime', 'Decay']).map(key => Math.max(0, number(key)) * 1000);
  const intervals = event.type === 'SPL' ? ['Lifespan', 'Decay'].map(stage => [number(`UV${stage}Start`), number(`UV${stage}End`), Math.max(0, number(`${stage}Repeat`, 1))]) : [];
  const resourcePath = `ReplaceableTextures\\Splats\\${file.replace(/\.(blp|dds|tga|png)$/i, '')}.${textureExtension}`;
  return { ...event, resourcePath, colors, intervalTimesMs, intervals, lifeSpanMs: intervalTimesMs.reduce((a, b) => a + b, 0),
    scale: Math.max(0, number('Scale')), columns: event.type === 'SPL' ? Math.max(1, Math.floor(number('Columns', 1))) : 1,
    rows: event.type === 'SPL' ? Math.max(1, Math.floor(number('Rows', 1))) : 1, blendMode: number('BlendMode') };
}

/** Stateless event instances: rewinding/repeating a frame returns the same keys. */
export function activeEventInstances(model, definitions, { sequenceIndex = -1, frame = 0, globalTime = frame, maxInstances = 128 } = {}) {
  const result = [], interval = model.Sequences?.[sequenceIndex]?.Interval;
  const limit = Number.isFinite(maxInstances) ? clamp(Math.floor(maxInstances), 0, 512) : 128;
  for (const [eventIndex, event] of (model.EventObjects || []).entries()) {
    const definition = definitions instanceof Map ? definitions.get(event.Name) : definitions?.[event.Name];
    if (!definition || !(definition.lifeSpanMs > 0) || !Number.isFinite(definition.lifeSpanMs) || !limit) continue;
    const globalId = event.GlobalSeqId ?? event.GlobalSequenceId;
    const global = Number.isInteger(globalId) && globalId >= 0, duration = model.GlobalSequences?.[globalId];
    if (global && !(duration > 0) || !global && (!interval || frame < interval[0] || frame > interval[1])) continue;
    const now = global ? globalTime : frame;
    if (!Number.isFinite(now) || now < 0) continue;
    const tracks = [...new Set(Array.from(event.EventTrack || []))].filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => b - a);
    for (const triggerFrame of tracks) {
      let count = 0;
      if (global) {
        if (triggerFrame > duration) continue;
        const latestCycle = Math.floor((now - triggerFrame) / duration);
        for (let cycle = latestCycle; cycle >= 0 && count < limit; cycle--) {
          const ageMs = now - (cycle * duration + triggerFrame);
          if (ageMs >= definition.lifeSpanMs) break;
          if (ageMs >= 0) { result.push({ key: `${eventIndex}:g${globalId}:${cycle}:${triggerFrame}`, event, eventIndex, definition, triggerFrame, ageMs }); count++; }
        }
      } else if (triggerFrame >= interval[0] && triggerFrame <= interval[1] && triggerFrame <= now && now - triggerFrame < definition.lifeSpanMs) {
        result.push({ key: `${eventIndex}:s${sequenceIndex}:${triggerFrame}`, event, eventIndex, definition, triggerFrame, ageMs: now - triggerFrame }); count++;
      }
    }
  }
  return result.sort((a, b) => a.ageMs - b.ageMs || a.eventIndex - b.eventIndex || a.key.localeCompare(b.key)).slice(0, limit);
}

/** Color and atlas position follow upstream splat/ubersplat life-stage formulas. */
export function sampleEventDecal(definition, ageMs) {
  const times = definition.intervalTimesMs || [], colors = definition.colors || [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 0]];
  let stage = 0, factor = 0;
  if (definition.type === 'UBR') {
    if (ageMs < times[0]) factor = ageMs / times[0];
    else if (ageMs < times[0] + times[1]) factor = 1;
    else { stage = 1; factor = (ageMs - times[0] - times[1]) / (times[2] || 1); }
  } else if (ageMs < times[0]) factor = ageMs / times[0];
  else { stage = 1; factor = (ageMs - (times[0] || 0)) / (times[1] || 1); }
  factor = clamp(factor, 0, 1);
  const color = colors[stage].map((value, i) => value + (colors[stage + 1][i] - value) * factor);
  const [start = 0, end = 0, repeat = 1] = definition.intervals?.[stage] || [], columns = definition.columns || 1, rows = definition.rows || 1;
  const count = end - start, cell = clamp(count > 0 ? start + Math.floor(count * repeat * factor) % count : start, 0, columns * rows - 1);
  const left = Math.floor(cell % columns) / columns, top = Math.floor(cell / columns) / rows;
  return { color, uv: [left, top, left + 1 / columns, top + 1 / rows] };
}
