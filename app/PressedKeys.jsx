import React, { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { chordFromEvent, formatChord, isTextEditingTarget } from '../src/preferences.js';
import { translate } from '../src/localization.js';
import './pressed-keys.css';

/** Presentation only: never cancels input or records text typed into an editor. */
export default function PressedKeys({ enabled }) {
  const [chords, setChords] = useState([]);
  useEffect(() => {
    setChords([]);
    if (!enabled) return;
    let timer, serial = 0; const observed=new WeakSet();
    const show = chord => {
      if (!chord) return;
      flushSync(() => setChords(items => [...items.slice(-3), { id: ++serial, label: chord }]));
      clearTimeout(timer); timer = setTimeout(() => setChords([]), 2200);
    };
    const key = event => { if (observed.has(event)) return; observed.add(event); if (!event.repeat && !isTextEditingTarget(event.target)) show(formatChord(chordFromEvent(event)).replaceAll('+', ' + ')); };
    const pointer = event => {
      if (isTextEditingTarget(event.target)) return;
      show([event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Win', ['LMB','MMB','RMB'][event.button] || `Mouse ${event.button + 1}`].filter(Boolean).join(' + '));
    };
    const wheel = event => { if (!isTextEditingTarget(event.target)) show([event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.deltaY < 0 ? 'Wheel Up' : 'Wheel Down'].filter(Boolean).join(' + ')); };
    const clear = () => { clearTimeout(timer); setChords([]); };
    const shortcut = event => key(event.detail);
    window.addEventListener('mdlxl-input-observed', shortcut);
    window.addEventListener('keydown', key, true); window.addEventListener('pointerdown', pointer, true); window.addEventListener('wheel', wheel, { capture: true, passive: true }); window.addEventListener('blur', clear);
    return () => { clearTimeout(timer); window.removeEventListener('mdlxl-input-observed', shortcut); window.removeEventListener('keydown', key, true); window.removeEventListener('pointerdown', pointer, true); window.removeEventListener('wheel', wheel, true); window.removeEventListener('blur', clear); };
  }, [enabled]);
  return enabled && <div className="pressed-keys" aria-label="Pressed keys" aria-live="off">{chords.map(chord => <div key={chord.id}>{chord.label.split(' + ').map(part=>translate(part)).join(' + ')}</div>)}</div>;
}
