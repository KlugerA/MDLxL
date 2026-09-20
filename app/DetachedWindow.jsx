import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { applyApplicationTheme } from './theme.js';

function copyStyles(targetDocument) {
  const pending = [];
  for (const source of document.querySelectorAll('link[rel="stylesheet"], style')) {
    const copy = source.cloneNode(true);
    if (source.tagName === 'LINK') {
      copy.href = source.href;
      pending.push(new Promise(resolve => {
        const settled = () => resolve();
        copy.addEventListener('load', settled, { once: true });
        copy.addEventListener('error', settled, { once: true });
        setTimeout(settled, 3000);
      }));
    }
    targetDocument.head.appendChild(copy);
  }
  return Promise.all(pending);
}

export default function DetachedWindow({ childWindow, title, preferences, onClose, children }) {
  const [container, setContainer] = useState(null), closing = useRef(false), onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (!childWindow || childWindow.closed) { onCloseRef.current?.(); return undefined; }
    const targetDocument = childWindow.document;
    targetDocument.title = title;
    targetDocument.documentElement.lang = document.documentElement.lang || 'en';
    targetDocument.head.replaceChildren();
    targetDocument.body.replaceChildren();
    targetDocument.body.className = 'mdlxl-detached-window';
    let disposed = false, registered = false;
    const root = targetDocument.createElement('div');
    root.className = 'mdlxl-detached-root';
    targetDocument.body.appendChild(root);
    const forwardKeyDown = event => window.dispatchEvent(new CustomEvent('mdlxl-detached-keydown', { detail: event }));
    const forwardKeyUp = event => window.dispatchEvent(new CustomEvent('mdlxl-detached-keyup', { detail: event }));
    const forwardBlur = () => window.dispatchEvent(new CustomEvent('mdlxl-detached-blur'));
    targetDocument.addEventListener('keydown', forwardKeyDown, true);
    targetDocument.addEventListener('keyup', forwardKeyUp, true);
    childWindow.addEventListener('blur', forwardBlur);
    copyStyles(targetDocument).then(() => {
      if (disposed) return;
      registered = true;
      window.dispatchEvent(new CustomEvent('mdlxl-detached-root', { detail: { root, add: true } }));
      setContainer(root);
      childWindow.focus();
    });
    const closed = () => { if (!closing.current) onCloseRef.current?.(); };
    childWindow.addEventListener('beforeunload', closed);
    return () => {
      disposed = true;
      closing.current = true;
      childWindow.removeEventListener('beforeunload', closed);
      childWindow.removeEventListener('blur', forwardBlur);
      targetDocument.removeEventListener('keydown', forwardKeyDown, true);
      targetDocument.removeEventListener('keyup', forwardKeyUp, true);
      if (registered) window.dispatchEvent(new CustomEvent('mdlxl-detached-root', { detail: { root, add: false } }));
      setContainer(null);
      if (!childWindow.closed) childWindow.close();
    };
  }, [childWindow, title]);

  useEffect(() => {
    if (childWindow && !childWindow.closed) applyApplicationTheme(preferences, childWindow.document);
  }, [childWindow, preferences]);

  return container ? createPortal(children, container) : null;
}
