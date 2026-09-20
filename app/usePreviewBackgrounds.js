import { useCallback, useEffect, useRef, useState } from 'react';
import { PREVIEW_BACKGROUNDS } from './preview-backgrounds.js';

export function usePreviewBackgrounds(active, selected, onSelect, onStatus) {
  const native = !!window.desktop?.listPreviewBackgrounds;
  const [items, setItems] = useState(native ? [] : PREVIEW_BACKGROUNDS);
  const [asset, setAsset] = useState(null);
  const latest = useRef(); latest.current = { selected, onSelect, onStatus };
  const refreshGeneration = useRef(0), catalogSignature = useRef(null);
  const refresh = useCallback(async () => {
    if (!native) return;
    const generation = ++refreshGeneration.current;
    try {
      const catalog = await window.desktop.listPreviewBackgrounds();
      if (generation !== refreshGeneration.current) return;
      if (catalog.signature !== catalogSignature.current) {
        catalogSignature.current = catalog.signature;
        setItems(catalog.items.map(item => ({ ...item, label: item.name })));
      }
      const current = latest.current.selected;
      if (current && !catalog.items.some(item => item.id === current)) {
        // Retain a previously selected bundled background after upgrading from
        // the original fixed list, whose IDs omitted the filename extension.
        const migrated = catalog.items.find(item => item.id === `${current}.png`);
        latest.current.onSelect(migrated?.id || '');
      }
    } catch (error) { latest.current.onStatus(`Backgrounds: ${error.message}`, true); }
  }, [native]);
  useEffect(() => {
    if (!active) return;
    refresh(); window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [active, refresh]);
  const selectedItem = items.find(item => item.id === selected);
  useEffect(() => {
    if (!active || !selectedItem) { setAsset(null); return; }
    if (!native) { setAsset({ id: selected, url: selectedItem.url, type: selectedItem.mime || 'image/png' }); return; }
    let alive = true, url;
    setAsset(null);
    window.desktop.readPreviewBackground(selectedItem.id).then(record => {
      if (!alive) return;
      url = URL.createObjectURL(new Blob([record.bytes], { type: record.mime }));
      setAsset({ id: selectedItem.id, url, type: record.mime });
    }).catch(error => { if (alive) latest.current.onStatus(`Backgrounds: ${error.message}`, true); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [active, native, selectedItem?.id, selectedItem?.signature]);
  const openFolder = useCallback(async () => {
    try { await window.desktop.openPreviewBackgroundFolder(); }
    catch (error) { latest.current.onStatus(`Backgrounds: ${error.message}`, true); }
  }, []);
  return { items, refresh, openFolder: native ? openFolder : undefined, url: asset?.id === selected ? asset.url : null, type: asset?.id === selected ? asset.type : null, loading: active && !!selectedItem && (!asset || asset.id !== selected) };
}
