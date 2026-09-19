/** Leader sequences extend Hotkeys without taking any original MDLVis key. */
export const WARMKEY_LEADER = 'Ctrl+Alt+Space';
const leaderPart = value => ({ control: 'ctrl', option: 'alt', spacebar: 'space', ' ': 'space' })[value] || value;
export function normalizeWarmKeySequence(value) {
  if (typeof value !== 'string' || value.length > 100) return '';
  const parts = value.split('>');
  if (parts.length !== 2) return '';
  const leader = parts[0].trim().toLowerCase().split('+').map(part => leaderPart(part.trim())).sort().join('+');
  const code = parts[1].trim().toUpperCase();
  return leader === 'alt+ctrl+space' && /^[A-Z0-9]{3}$/.test(code) ? `${WARMKEY_LEADER} > ${code}` : '';
}
export const warmKeyCode = value => normalizeWarmKeySequence(value).split(' > ')[1] || '';
export const warmKeySequence = code => normalizeWarmKeySequence(`${WARMKEY_LEADER} > ${code}`);

/** Core slots use A00–AZZ. Existing direct defaults and their aliases stay intact. */
export function coreWarmKeyDefaults(actions) {
  if (actions.length > 36 * 36) throw new Error('The core Hotkeys code range is full.');
  return actions.map((action, position) => ({ ...action,
    defaultKeys: action.defaultKeys?.length ? [...action.defaultKeys] : [warmKeySequence(`A${position.toString(36).toUpperCase().padStart(2, '0')}`)] }));
}

const contextPrefixes = '0123456789BCDEFGHIJKLMNOPQRSTUVWXYZ';
const contextCapacity = contextPrefixes.length * 36 * 36;
const validContextCode = code => typeof code === 'string' && /^[0-9B-Z][A-Z0-9]{2}$/.test(code);
const contextCode = slot => contextPrefixes[Math.floor(slot / (36 * 36))] + (slot % (36 * 36)).toString(36).toUpperCase().padStart(2, '0');
function hashId(id) { let value = 2166136261; for (let i = 0; i < id.length; i++) value = Math.imul(value ^ id.charCodeAt(i), 16777619) >>> 0; return value; }

/**
 * Preserve stored contextual codes first, then allocate unseen IDs in stable ID
 * order. New controls never move an existing shortcut. A separate namespace
 * prevents future core commands from taking contextual defaults.
 */
export function contextualWarmKeyDefaults(actions, reservedKeys = []) {
  const used = new Set(actions.filter(action => !action.contextual).flatMap(action => action.defaultKeys || []).map(warmKeyCode).filter(Boolean));
  const assigned = new Map();
  const contextual = actions.filter(action => action.contextual).slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const action of contextual) {
    const code = action.defaultCode;
    if (validContextCode(code) && !used.has(code)) { assigned.set(action.id, code); used.add(code); }
  }
  // User-assigned codes also reserve slots for controls discovered in the future.
  for (const key of reservedKeys) { const code = warmKeyCode(key); if (code) used.add(code); }
  for (const action of contextual) {
    if (assigned.has(action.id)) continue;
    const start = hashId(action.id) % contextCapacity;
    let code;
    for (let step = 0; step < contextCapacity; step++) {
      const candidate = contextCode((start + step) % contextCapacity);
      if (!used.has(candidate)) { code = candidate; break; }
    }
    if (!code) throw new Error('The contextual Hotkeys code range is full.');
    assigned.set(action.id, code); used.add(code);
  }
  return actions.map(action => action.contextual ? { ...action, defaultCode: assigned.get(action.id), defaultKeys: [warmKeySequence(assigned.get(action.id))] } : action);
}

const isLeader = event => event.ctrlKey && event.altKey && !event.shiftKey && !event.metaKey && (event.key === ' ' || event.key === 'Space' || event.code === 'Space');
const modifierKey = key => ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph'].includes(key);
function letterFromEvent(event) {
  if (typeof event.key === 'string' && /^[a-z0-9]$/i.test(event.key)) return event.key.toUpperCase();
  const code = /^(?:Key([A-Z])|Digit([0-9])|Numpad([0-9]))$/.exec(event.code || '');
  return code ? code[1] || code[2] || code[3] : '';
}

/** DOM-free keyboard state machine shared by dispatch and the Settings recorder. */
export class WarmKeySequence {
  constructor({ timeoutMs = 4000 } = {}) { this.timeoutMs = timeoutMs; this.cancel(); }
  cancel() { this.active = false; this.code = ''; this.expiresAt = 0; }
  expire(now = Date.now()) { if (!this.active || now < this.expiresAt) return false; this.cancel(); return true; }
  feed(event, now = Date.now()) {
    const expired = this.expire(now);
    const result = (consume = false, extra = {}) => ({ consume, pending: this.active, code: this.code, chord: '', cancelled: expired, ...extra });
    if (!event) return result();
    if (event.isComposing || event.keyCode === 229 || event.getModifierState?.('AltGraph')) { const active = this.active; this.cancel(); return result(false, { cancelled: active || expired }); }
    if (event.repeat) return result(this.active);
    if (isLeader(event)) { this.active = true; this.code = ''; this.expiresAt = now + this.timeoutMs; return result(true); }
    if (!this.active) return result();
    if (event.key === 'Escape') { this.cancel(); return result(true, { cancelled: true }); }
    if (modifierKey(event.key)) return result(true);
    if (event.key === 'Backspace') { this.code = this.code.slice(0, -1); this.expiresAt = now + this.timeoutMs; return result(true); }
    const letter = letterFromEvent(event);
    if (!letter || event.metaKey) { this.cancel(); return result(true, { cancelled: true }); }
    this.code += letter; this.expiresAt = now + this.timeoutMs;
    if (this.code.length < 3) return result(true);
    const code = this.code, chord = warmKeySequence(code);
    this.cancel(); return result(true, { code, chord });
  }
}
