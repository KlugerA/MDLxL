import { bindDropdownWheel } from '../src/dropdown-wheel.js';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// The portal keeps the same React document/undo owner while rendering in a
// separate native window. Closing it returns the editor to the main window.
export default function DetachedUVWindow({ target, children, onClose, title }) {
  const [container, setContainer] = useState(null);
  const latest = useRef(onClose); latest.current = onClose;
  useEffect(() => {
    if (!target || target.closed) { latest.current(); return; }
    const doc = target.document;
    doc.head.replaceChildren();
    const base = doc.createElement('base'); base.href = document.baseURI; doc.head.appendChild(base);
    // Lazy workspace/timeline styles can arrive after this window opens.
    const styles = new Map();
    const syncStyles = () => {
      const active = new Set(document.querySelectorAll('link[rel="stylesheet"], style'));
      for (const [source, clone] of styles) if (!active.has(source)) { clone.remove(); styles.delete(source); }
      for (const source of active) {
        let clone = styles.get(source);
        if (!clone || !source.isEqualNode(clone)) {
          clone?.remove(); clone = source.cloneNode(true); styles.set(source, clone);
        }
        doc.head.appendChild(clone);
      }
    };
    syncStyles();
    const styleObserver = new MutationObserver(syncStyles);
    styleObserver.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true });
    const root = doc.createElement('div'); root.className = 'classic-app detached-uv-root';
    root.style.cssText = 'height:100vh;display:flex;flex-direction:column;overflow:hidden';
    doc.body.style.cssText = 'margin:0;overflow:hidden'; doc.body.replaceChildren(root);
    const syncTheme = () => {
      doc.documentElement.lang = document.documentElement.lang;
      doc.documentElement.dataset.theme = document.documentElement.dataset.theme || 'light';
      doc.documentElement.dataset.palette = document.documentElement.dataset.palette || 'classic';
      doc.documentElement.dataset.shortcutHints = document.documentElement.dataset.shortcutHints || 'false';
      doc.documentElement.style.cssText = document.documentElement.style.cssText;
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme','data-palette','data-shortcut-hints', 'style', 'lang'] });
    const close = () => latest.current(); target.addEventListener('beforeunload', close);
    // Preserve the original event target so shared shortcut rules still leave
    // text fields and native controls alone in the detached document.
    const keyboard = event => window.dispatchEvent(new CustomEvent('mdlxl-detached-keydown', {detail:event}));
    const keyup = event => window.dispatchEvent(new CustomEvent('mdlxl-detached-keyup', {detail:event}));
    const blur = () => window.dispatchEvent(new CustomEvent('mdlxl-detached-blur', {detail:doc}));
    target.addEventListener('keydown', keyboard, true);
    target.addEventListener('keyup', keyup, true); target.addEventListener('blur', blur);
    const register = () => window.dispatchEvent(new CustomEvent('mdlxl-detached-root', {detail:{root,add:true}}));
    // Child effects may run before the provider starts listening.
    window.addEventListener('mdlxl-hotkeys-ready', register); register();
    const unbindWheel=bindDropdownWheel(doc);
    setContainer(root);
    return () => {
      window.removeEventListener('mdlxl-hotkeys-ready', register);
      window.dispatchEvent(new CustomEvent('mdlxl-detached-root', {detail:{root,add:false}})); blur();
      unbindWheel(); observer.disconnect(); styleObserver.disconnect();
      target.removeEventListener('keydown', keyboard, true); target.removeEventListener('keyup', keyup, true); target.removeEventListener('blur', blur);
      target.removeEventListener('beforeunload', close); if (!target.closed) target.close();
    };
  }, [target]);
  useEffect(() => { if (target && !target.closed) target.document.title = title; }, [target, title, container]);
  return container ? createPortal(children, container) : null;
}
