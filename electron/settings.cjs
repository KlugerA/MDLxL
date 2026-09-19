const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validatePreferences(value) {
  if (!record(value)) throw Error('Invalid preferences.');
  if (own(value, 'scrollSensitivity') && (typeof value.scrollSensitivity !== 'number' || !Number.isFinite(value.scrollSensitivity) || value.scrollSensitivity < 0.1 || value.scrollSensitivity > 10)) throw Error('Scroll sensitivity must be between 0.1 and 10.');
  if (own(value, 'wheelMode') && !['rotate', 'scroll', 'pointer'].includes(value.wheelMode)) throw Error('Invalid middle button mode.');
  if (own(value, 'pointerSensitivity') && (typeof value.pointerSensitivity !== 'number' || !Number.isFinite(value.pointerSensitivity) || value.pointerSensitivity < 0.01 || value.pointerSensitivity > 4)) throw Error('Pointer sensitivity must be between 0.01 and 4.');
  if (own(value, 'rightScrollAdjust') && typeof value.rightScrollAdjust !== 'boolean') throw Error('Invalid mouse adjustment setting.');
  if (own(value, 'graphics')) {
    const graphics = value.graphics;
    if (!record(graphics)) throw Error('Invalid graphical settings.');
    if (own(graphics, 'pixelRatio') && ![1, 1.5, 2].includes(graphics.pixelRatio)) throw Error('Invalid render resolution.');
    if (own(graphics, 'maxFps') && ![30, 60, 120].includes(graphics.maxFps)) throw Error('Invalid frame rate limit.');
    for (const key of ['antialias', 'textures', 'lighting', 'particles', 'pauseWhenHidden']) {
      if (own(graphics, key) && typeof graphics[key] !== 'boolean') throw Error(`Invalid graphical setting: ${key}.`);
    }
  }
  if (own(value, 'hotkeys')) {
    if (!record(value.hotkeys) || Object.keys(value.hotkeys).length > 5000) throw Error('Invalid Hotkeys settings.');
    for (const [id, keys] of Object.entries(value.hotkeys)) {
      if (!id || id.length > 2048 || /[\x00-\x1f]/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id) || !Array.isArray(keys) || keys.length > 8 || keys.some(key => typeof key !== 'string' || !key || key.length > 100 || /[\x00-\x1f]/.test(key))) throw Error('Invalid Hotkeys assignment.');
    }
  }
}

function applySettingsPatch(current, patch, normalizePreferences) {
  if (!record(patch)) throw Error('Invalid settings.');
  const next = { ...current };
  if (own(patch, 'historyBudgetBytes')) {
    const budget = patch.historyBudgetBytes;
    if (!Number.isSafeInteger(budget) || budget < 64 * 1048576 || budget > 4096 * 1048576) throw Error('Invalid undo memory limit.');
    next.historyBudgetBytes = budget;
  }
  if (own(patch, 'historyMaxSteps')) {
    const steps = patch.historyMaxSteps;
    if (!Number.isSafeInteger(steps) || steps < 10 || steps > 100000) throw Error('Invalid undo step limit.');
    next.historyMaxSteps = steps;
  }
  if (own(patch, 'gameData')) {
    // This field is written only by the native directory picker.  `null`
    // deliberately clears a previous choice without leaving a stale path in
    // the portable profile.
    if (patch.gameData === null) delete next.gameData;
    else {
      if (typeof patch.gameData !== 'string' || !patch.gameData.trim() || patch.gameData.length > 32768 || patch.gameData.includes('\0')) throw Error('Invalid game data folder.');
      next.gameData = patch.gameData.trim();
    }
  }
  if (own(patch, 'preferences')) {
    validatePreferences(patch.preferences);
    const previous = normalizePreferences(current.preferences);
    next.preferences = normalizePreferences({
      ...previous,
      ...patch.preferences,
      graphics: { ...previous.graphics, ...patch.preferences.graphics },
      // A supplied map is a complete set of overrides. An empty map restores defaults.
      hotkeys: own(patch.preferences, 'hotkeys') ? patch.preferences.hotkeys : previous.hotkeys,
    });
  }
  return next;
}

class SettingsStore {
  constructor(file, normalizePreferences) {
    this.file = file;
    this.normalizePreferences = normalizePreferences;
    this.settings = { preferences: normalizePreferences() };
    this.queue = Promise.resolve();
  }
  async load(fallbackFile) {
    let value;
    try { value = JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch { if (fallbackFile) try { value = JSON.parse(await fs.readFile(fallbackFile, 'utf8')); } catch {} }
    value = record(value) ? value : {};
    this.settings = { preferences: this.normalizePreferences(value.preferences) };
    // Preserve each valid legacy field independently if a settings file was damaged.
    for (const key of ['historyBudgetBytes', 'historyMaxSteps', 'gameData']) {
      if (own(value, key)) try { this.settings = applySettingsPatch(this.settings, { [key]: value[key] }, this.normalizePreferences); } catch {}
    }
    return this.settings;
  }
  configure(patch) {
    // Validate before enqueuing and snapshot IPC input so later callers cannot alter it.
    applySettingsPatch(this.settings, patch, this.normalizePreferences);
    const input = structuredClone(patch);
    const operation = this.queue.catch(() => {}).then(async () => {
      const next = applySettingsPatch(this.settings, input, this.normalizePreferences);
      if (JSON.stringify(next) === JSON.stringify(this.settings)) return this.settings;
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const temporary = this.file + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
      try {
        await fs.writeFile(temporary, JSON.stringify(next), { flag: 'wx' });
        await fs.rename(temporary, this.file);
      } catch (error) {
        await fs.unlink(temporary).catch(() => {});
        throw error;
      }
      this.settings = next;
      return next;
    });
    this.queue = operation;
    return operation;
  }
  async flush() { await this.queue.catch(() => {}); }
}

module.exports = { SettingsStore, applySettingsPatch, validatePreferences };
