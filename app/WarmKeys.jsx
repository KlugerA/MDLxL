import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { canHandleHotkeyEvent, chordFromEvent, effectiveBindings, formatChord, isTextEditingTarget, MAX_WARMKEY_ID_LENGTH } from '../src/preferences.js';
import { contextualWarmKeyDefaults, warmKeyCode, WarmKeySequence, WARMKEY_LEADER } from '../src/warmkey-defaults.js';
import { hotkeyBadge } from '../src/hotkey-badge.js';
import './settings.css';
import './warmkey-sequences.css';

const WarmKeysContext = createContext({ catalog: [], shortcuts: {} });
export const useWarmKeys = () => useContext(WarmKeysContext);
const CATALOG_STORAGE_KEY = 'mdlvis-classic-warmkeys-catalog-v1';
function loadCatalog() {
  try {
    const records = JSON.parse(localStorage.getItem(CATALOG_STORAGE_KEY) || '[]');
    return new Map((Array.isArray(records) ? records : []).slice(0, 40000).filter(item => item && typeof item.id === 'string' && item.id.length <= MAX_WARMKEY_ID_LENGTH && typeof item.label === 'string').map(item => [item.id, { id: item.id, label: item.label.slice(0, 250), category: typeof item.category === 'string' ? item.category.slice(0, 100) : 'Context controls', scope: typeof item.scope === 'string' ? item.scope : 'context', defaultCode: item.defaultCode, defaultKeys: [], contextual: true }]));
  } catch { return new Map(); }
}

/** Explicit control identities compose with stable resource / section prefixes. */
export function controlActionId(element) {
  const id = element.getAttribute('data-warmkey');
  if (!id) return '';
  if (element.hasAttribute('data-warmkey-absolute')) return id;
  const prefixes = []; let parent = element.parentElement;
  while (parent) { const prefix = parent.getAttribute('data-warmkey-prefix'); if (prefix) prefixes.unshift(prefix); parent = parent.parentElement; }
  return [...prefixes, id].join(':');
}
function visible(element) {
  return !!element?.isConnected && !element.hidden && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0 && (element.ownerDocument.defaultView || window).getComputedStyle(element).visibility !== 'hidden';
}
function activeDialog(root) { return [...root.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(visible).at(-1); }
function enabled(element) { return !element.disabled && element.getAttribute('aria-disabled') !== 'true' && !element.closest('fieldset[disabled]'); }

function actionMetadata(element, id) {
  const title = element.hasAttribute('data-warmkey-base-title') ? element.getAttribute('data-warmkey-base-title') : element.getAttribute('title');
  const label = element.getAttribute('data-warmkey-label') || element.getAttribute('aria-label') || title || element.closest('label')?.textContent?.trim() || element.textContent?.replaceAll(element.querySelector('[data-warmkey-badge]')?.textContent || '\u0000', '').trim() || id;
  return { id, label, category: element.getAttribute('data-warmkey-category') || element.closest('[data-warmkey-category]')?.getAttribute('data-warmkey-category') || (id.includes(':') ? 'Context controls' : 'Controls'), scope: element.closest('[data-warmkey-scope]')?.getAttribute('data-warmkey-scope') || 'editor', defaultKeys: [], contextual: true };
}

/** All identities come from the catalog or explicit data-warmkey attributes, never inferred labels. */
export function WarmKeysProvider({ preferences, catalog = [], activeScope = 'editor', onAction, onCatalogChange, children }) {
  const root = useRef(null), discovered = useRef(null), [revision, setRevision] = useState(0), latest = useRef({});
  const detachedRoots = useRef(new Set());
  const controlRoots = () => [root.current, ...detachedRoots.current].filter(element => element?.isConnected);
  const [leaderCode, setLeaderCode] = useState(null);
  if (!discovered.current) discovered.current = loadCatalog();
  const merged = useMemo(() => {
    const map = new Map(discovered.current);
    for (const action of catalog) map.set(action.id, { ...map.get(action.id), contextual: false, scope: 'editor', ...action });
    for (const id of Object.keys(preferences?.hotkeys || {})) if (!map.has(id)) map.set(id, { id, label: id, category: 'Saved controls', scope: 'context', contextual: true, defaultKeys: [] });
    const actions = contextualWarmKeyDefaults([...map.values()], Object.values(preferences?.hotkeys || {}).flat());
    for (const action of actions) if (action.contextual) discovered.current.set(action.id, action);
    return actions;
  }, [catalog, preferences?.hotkeys, revision]);
  const shortcuts = useMemo(() => effectiveBindings(merged, preferences?.hotkeys), [merged, preferences?.hotkeys]);
  const shortcutSignature = JSON.stringify(shortcuts);
  latest.current = { catalog: merged, shortcuts, activeScope, onAction };

  useEffect(() => { onCatalogChange?.(merged); }, [merged, onCatalogChange]);
  useEffect(() => {
    if (!revision) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify([...discovered.current.values()].slice(-40000).map(({ id, label, category, scope, defaultCode }) => ({ id, label, category, scope, defaultCode })))); } catch { /* Settings still work when browser storage is unavailable. */ }
    }, 250);
    return () => clearTimeout(timer);
  }, [revision]);
  useEffect(() => {
    let queued = false, disposed = false;
    const discover = () => {
      queued = false; if (disposed || !root.current) return;
      let changed = false;
      for (const controlRoot of controlRoots()) for (const element of controlRoot.querySelectorAll('[data-warmkey]')) {
        const id = controlActionId(element); if (!id) continue;
        const currentTitle = element.getAttribute('title') || '';
        if (currentTitle !== element.getAttribute('data-warmkey-tooltip')) element.setAttribute('data-warmkey-base-title', currentTitle);
        const previous = discovered.current.get(id), meta = { ...actionMetadata(element, id), defaultCode: previous?.defaultCode, defaultKeys: previous?.defaultKeys || [] };
        if (!previous || JSON.stringify(previous) !== JSON.stringify(meta)) { discovered.current.set(id, meta); changed = true; }
        const keys = latest.current.shortcuts[id] || [];
        // aria-keyshortcuts describes simultaneous keys, not three-character sequences.
        element.setAttribute('aria-keyshortcuts', keys.filter(key => !warmKeyCode(key)).map(key => key.replaceAll('Ctrl', 'Control').replaceAll('Plus', '+')).join(' '));
        element.setAttribute('data-warmkey-shortcuts', keys.join(' / '));
        const title = [element.getAttribute('data-warmkey-base-title'), keys.map(hotkeyBadge).filter(Boolean).length ? `Hotkey: ${keys.map(hotkeyBadge).filter(Boolean).join(' / ')}` : ''].filter(Boolean).join('\n');
        element.setAttribute('title', title); element.setAttribute('data-warmkey-tooltip', title);
        if (element.tagName !== 'BUTTON' || element.getAttribute('data-warmkey-badges') === 'false') continue;
        let badge = element.querySelector(':scope > [data-warmkey-badge]');
        const text = keys.length ? hotkeyBadge(keys[0]) || formatChord(keys[0]) : '';
        if (!text) { if (badge) badge.remove(); element.classList.remove('warmkey-control'); continue; }
        element.classList.add('warmkey-control');
        if (!badge) { badge = element.ownerDocument.createElement('span'); badge.className = 'warmkey-badge'; badge.dataset.warmkeyBadge = ''; badge.setAttribute('aria-hidden', 'true'); element.appendChild(badge); }
        if (badge.textContent !== text) badge.textContent = text; badge.dataset.longHint=String(text.length>3);
        if (badge.title !== keys.map(formatChord).join(' / ')) badge.title = keys.map(formatChord).join(' / ');
      }
      if (changed) setRevision(value => value + 1);
    };
    const schedule = () => { if (!queued) { queued = true; queueMicrotask(discover); } };
    const observer = new MutationObserver(schedule);
    const observeRoots = () => {
      observer.disconnect();
      for (const element of controlRoots()) observer.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-warmkey', 'data-warmkey-prefix', 'data-warmkey-scope', 'data-warmkey-label', 'data-warmkey-category'] });
    };
    const registerRoot = event => {
      const element = event.detail?.root;
      if (!element?.querySelectorAll) return;
      if (event.detail.add) detachedRoots.current.add(element); else detachedRoots.current.delete(element);
      observeRoots(); schedule();
    };
    window.addEventListener('mdlxl-detached-root', registerRoot); observeRoots();
    window.dispatchEvent(new CustomEvent('mdlxl-hotkeys-ready'));
    root.current.__refreshWarmKeys = discover;
    discover();
    return () => { disposed = true; observer.disconnect(); window.removeEventListener('mdlxl-detached-root', registerRoot); detachedRoots.current.clear(); if (root.current) delete root.current.__refreshWarmKeys; };
  }, []);
  // Command enablement changes during playback; only actual binding changes need a DOM scan.
  useEffect(() => { root.current?.__refreshWarmKeys?.(); }, [shortcutSignature]);

  useEffect(() => {
    const sequence = new WarmKeySequence(); let timer;
    const cancel = () => { sequence.cancel(); clearTimeout(timer); setLeaderCode(null); };
    const consume = event => { window.dispatchEvent(new CustomEvent('mdlxl-input-observed', {detail:event})); event.preventDefault(); event.stopImmediatePropagation(); };
    const runShortcut = (chord, event) => {
      if (!root.current) return false;
      const { catalog: actions, shortcuts: bindings, activeScope: scope, onAction: dispatch } = latest.current;
      const matching = actions.filter(action => bindings[action.id]?.includes(chord));
      // Reject malformed persisted duplicate bindings instead of picking an arbitrary command.
      if (matching.length !== 1) return false;
      const action = matching[0]; if (!canHandleHotkeyEvent(event, action)) return false;
      const ownerDocument = event.target?.ownerDocument || document;
      const roots = controlRoots().filter(element => element.ownerDocument === ownerDocument);
      // A main application modal also blocks controls in the detached editor.
      const modal = activeDialog(root.current) || roots.map(activeDialog).filter(Boolean).at(-1), modalScope = modal?.getAttribute('data-warmkey-scope') || modal?.closest('[data-warmkey-scope]')?.getAttribute('data-warmkey-scope');
      const available = roots.flatMap(element => [...element.querySelectorAll('[data-warmkey]')]).filter(element => controlActionId(element) === action.id && visible(element) && (modal ? modal.contains(element) : !element.closest('[role="dialog"][aria-modal="true"]')));
      if (available.length && available.every(element => !enabled(element))) return false;
      const targets = available.filter(enabled);
      const target = targets.find(element => modal ? modal.contains(element) : !element.closest('[role="dialog"][aria-modal="true"]'));
      const canRun = (typeof action.run === 'function' || typeof dispatch === 'function' && !action.contextual) && (modal ? action.allowInModal === true || action.scope === modalScope : !action.scope || action.scope === scope || action.scope === 'global');
      if (!target && !canRun) return false;
      consume(event);
      if (target) {
        if (target.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]), textarea, select, [contenteditable="true"]')) { target.focus(); if (target.matches('input[type="text"], input:not([type]), textarea')) target.select?.(); }
        else { target.focus({ preventScroll: true }); target.click(); }
      } else if (typeof action.run === 'function') action.run(event); else dispatch(action.id, event);
      return true;
    };
    const keydown = event => {
      if (event.target?.closest?.('[data-warmkey-recording]')) { cancel(); return; }
      if (event.key === 'Escape' && event.target?.ownerDocument?.querySelector('.bone-create-menu')) return;
      if (event.key?.toLowerCase() === 'a' && !event.ctrlKey && !event.metaKey && !event.altKey &&
          event.target?.ownerDocument?.querySelector('.uv-workspace')) { cancel(); return; }
      const chord = chordFromEvent(event);
      if (sequence.active && (event.defaultPrevented || isTextEditingTarget(event.target) || event.isComposing || event.keyCode === 229)) { cancel(); return; }
      if (sequence.active || chord === WARMKEY_LEADER && canHandleHotkeyEvent(event)) {
        const next = sequence.feed(event);
        clearTimeout(timer); setLeaderCode(next.pending ? next.code : null);
        if (next.pending) timer = setTimeout(cancel, sequence.timeoutMs);
        if (next.chord) runShortcut(next.chord, event);
        if (next.consume) { consume(event); return; }
      }
      if (chord) runShortcut(chord, event);
    };
    window.addEventListener('keydown', keydown, true);
    const detachedKeydown = event => keydown(event.detail);
    window.addEventListener('mdlxl-detached-keydown', detachedKeydown);
    window.addEventListener('blur', cancel);
    window.addEventListener('mdlxl-detached-blur', cancel);
    window.addEventListener('pointerdown', cancel, true);
    const visibility = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', keydown, true); window.removeEventListener('mdlxl-detached-keydown', detachedKeydown); window.removeEventListener('blur', cancel); window.removeEventListener('mdlxl-detached-blur', cancel); window.removeEventListener('pointerdown', cancel, true); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => {
    const reveal = event => {
      if(event.key !== 'Alt' || event.ctrlKey || event.metaKey || isTextEditingTarget(event.target))return;
      const ownerDocument=event.target?.ownerDocument || document;
      const roots=controlRoots().filter(element=>element.ownerDocument===ownerDocument);
      const modal=activeDialog(root.current) || roots.map(activeDialog).filter(Boolean).at(-1);
      for(const controlRoot of controlRoots()) for(const element of controlRoot.querySelectorAll('.warmkey-control'))element.dataset.warmkeyAvailable=String(element.ownerDocument===ownerDocument&&enabled(element)&&visible(element)&&(!modal||modal.contains(element)));
      ownerDocument.documentElement.dataset.shortcutHints='true';
    };
    const dismiss = () => { for(const element of controlRoots())delete element.ownerDocument.documentElement.dataset.shortcutHints; delete document.documentElement.dataset.shortcutHints; };
    const released = event => { if (event.key === 'Alt' || !event.altKey) dismiss(); };
    window.addEventListener('keydown', reveal, true); window.addEventListener('keyup', released, true); window.addEventListener('blur', dismiss);
    const detachedReveal=event=>reveal(event.detail), detachedRelease=event=>released(event.detail);
    window.addEventListener('mdlxl-detached-keydown', detachedReveal); window.addEventListener('mdlxl-detached-keyup', detachedRelease); window.addEventListener('mdlxl-detached-blur', dismiss);
    return () => { window.removeEventListener('keydown', reveal, true); window.removeEventListener('keyup', released, true); window.removeEventListener('blur', dismiss); window.removeEventListener('mdlxl-detached-keydown', detachedReveal); window.removeEventListener('mdlxl-detached-keyup', detachedRelease); window.removeEventListener('mdlxl-detached-blur', dismiss); dismiss(); };
  }, []);
  return <WarmKeysContext.Provider value={{ catalog: merged, shortcuts }}><div ref={root} className="warmkeys-root">{children}{leaderCode !== null && <div className="warmkeys-sequence-cue" data-warmkey-sequence="" role="status" aria-live="polite"><strong>Hotkeys</strong><kbd>{leaderCode.padEnd(3, '·')}</kbd><span>Type the green code · Esc cancels</span></div>}</div></WarmKeysContext.Provider>;
}

/** Optional explicit badge for controls outside the discovery root. */
export function WarmKeyBadge({ actionId }) {
  const { shortcuts } = useWarmKeys(); const keys = shortcuts[actionId] || []; const label = keys.map(hotkeyBadge).find(Boolean);
  return label ? <span className="warmkey-badge" data-warmkey-badge="" aria-hidden="true" title={keys.map(formatChord).join(' / ')}>{label}</span> : null;
}
