import React, { useRef, useState } from 'react';
import { LANGUAGES } from '../src/localization.js';

/** SVG flags keep the language picker legible on Windows, where flag emoji can render as letters. */
function Flag({ language }) {
  if (language === 'ru') return <svg viewBox="0 0 39 26" aria-hidden="true"><rect width="39" height="26" fill="#fff"/><rect width="39" height="8.67" y="8.67" fill="#0039a6"/><rect width="39" height="8.67" y="17.33" fill="#d52b1e"/></svg>;
  if (language === 'es') return <svg viewBox="0 0 39 26" aria-hidden="true"><rect width="39" height="26" fill="#aa151b"/><rect width="39" height="13" y="6.5" fill="#f1bf00"/><path d="M6 9h4v8H6z" fill="#aa151b"/></svg>;
  if (language === 'zh') return <svg viewBox="0 0 39 26" aria-hidden="true"><rect width="39" height="26" fill="#de2910"/><path d="m7 3 1.1 3.3 3.5.05-2.8 2 1 3.3-2.8-2-2.8 2 1-3.3-2.8-2 3.5-.05z" fill="#ffde00"/></svg>;
  if (language === 'mordor') return <svg viewBox="0 0 39 26" aria-hidden="true"><rect width="39" height="26" rx="2" fill="#15110c"/><path d="M4 13c6-8 25-8 31 0-6 8-25 8-31 0Z" fill="#d99a25"/><path d="M9 13c4-4 17-4 21 0-4 4-17 4-21 0Z" fill="#1b1308"/><ellipse cx="19.5" cy="13" rx="3" ry="6" fill="#e8b841"/><circle cx="19.5" cy="13" r="1.3" fill="#0a0704"/></svg>;
  return <svg viewBox="0 0 39 26" aria-hidden="true"><rect width="39" height="26" fill="#fff"/>{Array.from({ length: 7 }, (_, i) => <rect key={i} width="39" height="2" y={i * 4} fill="#b22234"/>)}<rect width="17" height="14" fill="#3c3b6e"/>{Array.from({ length: 5 }, (_, y) => Array.from({ length: 6 }, (_, x) => <circle key={`${x}-${y}`} cx={1.5 + x * 2.7} cy={1.4 + y * 2.65} r=".7" fill="white"/>))}</svg>;
}

export default function LanguageSwitch({ language, onChange }) {
  const [open, setOpen] = useState(false), root = useRef(null);
  const current = LANGUAGES.find(item => item.id === language) || LANGUAGES[0];
  return <div ref={root} className="language-switch" onBlur={event => { if (!root.current?.contains(event.relatedTarget)) setOpen(false); }}>
    <button className="language-trigger" type="button" title="Language" aria-label="Language" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(value => !value)}><Flag language={current.id}/><span translate="no">{current.nativeLabel}</span><b aria-hidden="true">▾</b></button>
    {open && <div className="language-options" role="listbox" aria-label="Language">{LANGUAGES.map(item => <button key={item.id} type="button" role="option" aria-selected={item.id === current.id} onClick={() => { onChange(item.id); setOpen(false); }}><Flag language={item.id}/><span translate="no">{item.label}</span></button>)}</div>}
  </div>;
}
