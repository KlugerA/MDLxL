import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { applySelection, connectedVertices, insideTriangle } from './classic-gestures.js';
import { bindScrollSensitivity, graphicsOptions, pointerDragPoint, pointerSensitivityValue, sensitivityIndicatorStyle, sensitivityIndicatorText, wheelPixels } from './viewport-performance.js';
import { cameraBindings, uvTransformSensitivity, visualOptions } from '../src/preferences.js';
import { viewportCursor } from './viewport-cursors.js';
import { eligibleUVVertices, eligibleUVFaces, restrictUVChange } from '../src/uv-selection.js';
import { collapseUVCoordinates, foldUVCoordinates } from '../src/uv-tools.js';
import { occupiedUVTextureFrames } from '../src/uv-preview-display.js';

const indicesOf = selection => Array.from(selection || []);

/** Classic select/move/rotate/scale tools. UV V retains Warcraft's top-down convention. */
export default function UVEditor({ geoset, revision = 0, uvSet = 0, textureUrl, textureSize, selectedVertices = [], eligibleVertices, hiddenVertices = [], onSelectVertices, onChange, onPreviewChange, transformMode = 'select', cameraMode = 'work', preferences, onSensitivityChange, onPointerSensitivityChange, onWheelModeChange, onCameraModeToggle, suspended = false, showWires = true, showVertices = true, showGrid = true, showTextureFrame = false, textureFrameColor = '#ff3030' }) {
  const host = useRef(null), canvas = useRef(null);
  const state = useRef({ zoom: .55, panX: 0, panY: 0, uv: new Float32Array(), drag: null, image: null, draw: () => {} });
  const current = useRef({}); current.current = { geoset, uvSet, textureSize, selectedVertices, eligibleVertices, hiddenVertices, onSelectVertices, onChange, onPreviewChange, transformMode, cameraMode, preferences, onSensitivityChange, onPointerSensitivityChange, onWheelModeChange, onCameraModeToggle, suspended, showWires, showVertices, showGrid, showTextureFrame, textureFrameColor };
  const [imageError, setImageError] = useState(false), [adjustingSensitivity, setAdjustingSensitivity] = useState(null);
  const graphics = graphicsOptions(preferences);
  const count = (geoset?.TVertices?.[uvSet]?.length || 0) / 2;

  // History can patch typed arrays in place; revision must invalidate this drawing copy.
  const eligibilityKey = eligibleVertices === undefined ? '*' : indicesOf(eligibleVertices).join(',');
  useLayoutEffect(() => { state.current.uv = new Float32Array(geoset?.TVertices?.[uvSet] || []); state.current.drag = null; current.current.onPreviewChange?.(null); state.current.draw(); }, [geoset, uvSet, geoset?.TVertices?.[uvSet], revision, textureUrl, eligibilityKey]);
  useEffect(() => { state.current.draw(); }, [selectedVertices, hiddenVertices, eligibilityKey, showWires, showVertices, showGrid, showTextureFrame, textureFrameColor, textureSize?.[0], textureSize?.[1], preferences?.visuals, preferences?.theme]);
  useEffect(() => {
    let cancelled = false; state.current.image = null; setImageError(false);
    if (!textureUrl || !graphics.textures) { state.current.draw(); return; }
    const image = new Image();
    image.onload = () => { if (!cancelled) { state.current.image = image; state.current.draw(); } };
    image.onerror = () => { if (!cancelled) { setImageError(true); state.current.draw(); } };
    image.src = textureUrl;
    return () => { cancelled = true; };
  }, [textureUrl, graphics.textures]);

  useEffect(() => {
    const element = canvas.current, container = host.current, context = element.getContext('2d'), s = state.current;
    const ownerDocument = element.ownerDocument, ownerWindow = ownerDocument.defaultView || window;
    let width = 1, height = 1, ratio = 1;
    function mapping() {
      const sourceWidth = s.image?.naturalWidth || s.image?.width || Number(current.current.textureSize?.[0]) || 1;
      const sourceHeight = s.image?.naturalHeight || s.image?.height || Number(current.current.textureSize?.[1]) || 1;
      const aspect = Math.max(.01, sourceWidth / sourceHeight), base = Math.max(20, Math.min((width - 40) / 2.7, (height - 40) / 2.3));
      const sizeX = base * (aspect >= 1 ? aspect : 1) * s.zoom, sizeY = base * (aspect >= 1 ? 1 : 1 / aspect) * s.zoom;
      return { sizeX, sizeY, x: (width - sizeX) / 2 + s.panX, y: (height - sizeY) / 2 + s.panY };
    }
    function eligible() {
      const p = current.current;
      return eligibleUVVertices(p.geoset, p.eligibleVertices ?? Array.from({ length: s.uv.length / 2 }, (_, index) => index), p.hiddenVertices, p.uvSet);
    }
    function selection() {
      const allowed = new Set(eligible());
      return indicesOf(current.current.selectedVertices).filter(index => allowed.has(index));
    }
    function draw() {
      const p = current.current, { sizeX, sizeY, x, y } = mapping();
      element.style.cursor = s.drag?.cursor || viewportCursor(p.cameraMode, p.transformMode);
      // Suspended locks editing input (for example while Select New owns the
      // model preview), but the texture workstation must remain visible.
      if (ownerDocument.hidden && graphicsOptions(p.preferences).pauseWhenHidden) return;
      const visuals = visualOptions(p.preferences);
      context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height);
      context.fillStyle = visuals.background; context.fillRect(0, 0, width, height);
      if (s.image) {
        // MDLVis presents one seamless infinite texture plane. Only the image
        // repeats; UV coordinates stay unbounded and are never wrapped.
        const pattern = context.createPattern(s.image, 'repeat');
        if (pattern) {
          const scaleX = sizeX / s.image.width, scaleY = sizeY / s.image.height;
          context.save(); context.translate(x, y); context.scale(scaleX, scaleY);
          context.fillStyle = pattern;
          context.fillRect(-x / scaleX, -y / scaleY, width / scaleX, height / scaleY);
          context.restore();
        }
      } else if (p.showGrid) {
        const cellX = sizeX / 16, cellY = sizeY / 16;
        for (let row = -32; row < 48; row++) for (let col = -32; col < 48; col++) { context.fillStyle = (row + col) % 2 ? visuals.gridMinor : visuals.background; context.fillRect(x + col * cellX, y + row * cellY, cellX + 1, cellY + 1); }
      }
      context.strokeStyle = visuals.gridMajor; context.lineWidth = visuals.lineWidth; context.strokeRect(x, y, sizeX, sizeY);
      const uv = s.uv, allowed = eligible(), faces = eligibleUVFaces(p.geoset, allowed, p.uvSet);
      if (p.showTextureFrame) {
        // Mark every repeated texture frame used by this UV topology.
        const bounds={minU:(-x)/sizeX-1,maxU:(width-x)/sizeX+1,minV:(-y)/sizeY-1,maxV:(height-y)/sizeY+1};
        context.save(); context.strokeStyle = /^#[0-9a-f]{6}$/i.test(p.textureFrameColor) ? p.textureFrameColor : '#ff3030'; context.lineWidth = 3;
        for(const [frameU,frameV] of occupiedUVTextureFrames(uv,faces,allowed,bounds))context.strokeRect(x+frameU*sizeX,y+frameV*sizeY,sizeX,sizeY);
        context.restore();
      }
      const selected = new Set(selection());
      context.beginPath(); context.strokeStyle = visuals.wireframe; context.lineWidth = visuals.lineWidth;
      for (const ids of faces) {
        // Selected topology remains visible independently of the 3D wire overlay.
        if (!p.showWires && !ids.some(index => selected.has(index))) continue;
        const [a, b, c] = ids.map(index => index * 2);
        context.moveTo(x + uv[a] * sizeX, y + uv[a + 1] * sizeY); context.lineTo(x + uv[b] * sizeX, y + uv[b + 1] * sizeY); context.lineTo(x + uv[c] * sizeX, y + uv[c + 1] * sizeY); context.closePath();
      }
      context.stroke();
      for (const i of allowed) {
        if (!p.showVertices && !selected.has(i)) continue;
        const sx = x + uv[i * 2] * sizeX, sy = y + uv[i * 2 + 1] * sizeY;
        if (sx < -5 || sy < -5 || sx > width + 5 || sy > height + 5) continue;
        context.fillStyle = selected.has(i) ? visuals.selectedVertex : visuals.vertex; context.fillRect(sx - visuals.vertexSize / 2, sy - visuals.vertexSize / 2, visuals.vertexSize, visuals.vertexSize);
      }
      if (s.drag?.type === 'select' && Math.hypot(s.drag.endX - s.drag.x, s.drag.endY - s.drag.y) > 5) {
        const drag = s.drag; context.strokeStyle = visuals.selection; context.setLineDash([2, 2]);
        context.strokeRect(drag.x + .5, drag.y + .5, drag.endX - drag.x, drag.endY - drag.y); context.setLineDash([]);
      }
    }
    s.draw = draw;
    function resize() {
      width = Math.max(1, container.clientWidth); height = Math.max(1, container.clientHeight); ratio = Math.min(graphicsOptions(current.current.preferences).pixelRatio, ownerWindow.devicePixelRatio || 1);
      element.width = Math.round(width * ratio); element.height = Math.round(height * ratio); element.style.width = width + 'px'; element.style.height = height + 'px'; draw();
    }
    s.resize = resize;
    const observer = new ownerWindow.ResizeObserver(resize); observer.observe(container); resize();
    function point(event) { const rect = element.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
    function centerOf(indices, values = s.uv) {
      const center = [0, 0]; for (const index of indices) { center[0] += values[index * 2]; center[1] += values[index * 2 + 1]; }
      if (indices.length) { center[0] /= indices.length; center[1] /= indices.length; } return center;
    }
    function pointerDown(event) {
      if (current.current.suspended || s.drag || event.button > 2) return;
      const p = current.current, { x, y } = point(event), m = mapping(), indices = selection();
      const binding = event.button === 2 ? cameraBindings(p.preferences).right : event.button === 1 ? cameraBindings(p.preferences).middle : null;
      if (binding === 'none' || binding === 'toggle') return;
      element.focus(); element.setPointerCapture(event.pointerId);
      // A 2D UV view pans for either camera-navigation mode; camera mode must never edit UVs.
      const type = binding ? (binding === 'zoom' ? 'zoom' : 'pan') : p.cameraMode === 'move' || p.cameraMode === 'rotate' ? 'pan' : p.cameraMode === 'zoom' ? 'zoom' : p.transformMode !== 'select' && indices.length ? p.transformMode : 'select';
      const sensitivity = ['pan', 'zoom'].includes(type) ? pointerSensitivityValue(p.preferences?.pointerSensitivity) : uvTransformSensitivity(p.preferences);
      const navigationMode = binding === 'pan' ? 'move' : binding || p.cameraMode;
      const cursor = type === 'pan' && navigationMode === 'move' ? 'grabbing' : viewportCursor(navigationMode, p.transformMode);
      s.drag = { type, cursor, x, y, endX: x, endY: y, indices, shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey, pointerSensitivity: sensitivity * (event.altKey ? (p.preferences?.fineSensitivity ?? 0.2) : 1), original: new Float32Array(s.uv), sizeX: m.sizeX, sizeY: m.sizeY, center: centerOf(indices), panX: s.panX, panY: s.panY, zoom: s.zoom, moved: false };
      s.drag.pivotScreen = [m.x + s.drag.center[0] * m.sizeX, m.y + s.drag.center[1] * m.sizeY]; draw();
    }
    function pointerMove(event) {
      const drag = s.drag; if (!drag) return;
      const rawEnd = point(event), { x, y } = drag.type === 'select' ? rawEnd : pointerDragPoint(drag, rawEnd, drag.pointerSensitivity);
      const dx = x - drag.x, dy = y - drag.y; drag.endX = x; drag.endY = y; drag.moved = Math.hypot(dx, dy) > 1;
      if (drag.type === 'pan') { s.panX = drag.panX + dx; s.panY = drag.panY + dy; }
      if (drag.type === 'zoom') s.zoom = Math.max(.05, Math.min(40, drag.zoom * Math.exp(-dy * .01)));
      if (['translate', 'move', 'rotate', 'scale'].includes(drag.type)) {
        s.uv.set(drag.original);
        const a = [drag.x - drag.pivotScreen[0], drag.y - drag.pivotScreen[1]], b = [x - drag.pivotScreen[0], y - drag.pivotScreen[1]];
        let angle = Math.hypot(...a) > 12 && Math.hypot(...b) > 12 ? Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]) : dx * .01;
        if (event.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * Math.PI / 12;
        const factor = Math.max(0, 1 + dx / 100);
        for (const index of drag.indices) {
          const offset = index * 2, u = drag.original[offset] - drag.center[0], v = drag.original[offset + 1] - drag.center[1];
          if (drag.type === 'translate' || drag.type === 'move') { s.uv[offset] += dx / drag.sizeX; if (!event.shiftKey) s.uv[offset + 1] += dy / drag.sizeY; }
          if (drag.type === 'scale') { s.uv[offset] = drag.center[0] + u * factor; s.uv[offset + 1] = drag.center[1] + v * (event.shiftKey ? 1 : factor); }
          if (drag.type === 'rotate') { s.uv[offset] = drag.center[0] + u * Math.cos(angle) - v * Math.sin(angle); s.uv[offset + 1] = drag.center[1] + u * Math.sin(angle) + v * Math.cos(angle); }
        }
      }
      if (['translate', 'move', 'rotate', 'scale'].includes(drag.type)) current.current.onPreviewChange?.(restrictUVChange(current.current.geoset, current.current.uvSet, s.uv, drag.indices));
      draw();
    }
    function pointerUp(event) {
      const p = current.current, drag = s.drag; if (!drag) return; s.drag = null;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      if (['translate', 'move', 'rotate', 'scale'].includes(drag.type) && drag.moved) p.onChange?.(restrictUVChange(p.geoset, p.uvSet, s.uv, drag.indices));
      p.onPreviewChange?.(null);
      if (drag.type === 'select') {
        const m = mapping(), found = [], allowed = eligible(), rectangle = Math.hypot(drag.endX - drag.x, drag.endY - drag.y) > 5;
        let nearest = -1, distance = Math.max(5, visualOptions(p.preferences).vertexSize);
        for (const index of allowed) {
          const x = m.x + s.uv[index * 2] * m.sizeX, y = m.y + s.uv[index * 2 + 1] * m.sizeY;
          if (rectangle) { if (x >= Math.min(drag.x, drag.endX) && x <= Math.max(drag.x, drag.endX) && y >= Math.min(drag.y, drag.endY) && y <= Math.max(drag.y, drag.endY)) found.push(index); }
          else { const d = Math.abs(x - drag.endX) + Math.abs(y - drag.endY); if (d < distance) { nearest = index; distance = d; } }
        }
        if (nearest >= 0) found.push(nearest);
        else if (!rectangle) {
          for (const ids of eligibleUVFaces(p.geoset, allowed, p.uvSet)) {
            const points = ids.map(id => [m.x + s.uv[id * 2] * m.sizeX, m.y + s.uv[id * 2 + 1] * m.sizeY]);
            if (insideTriangle([drag.endX, drag.endY], ...points)) { found.push(...ids); break; }
          }
        }
        p.onSelectVertices?.(applySelection(selection(), found, drag));
      }
      draw();
    }
    function cancelGesture() { if (s.drag?.original) s.uv.set(s.drag.original); s.drag = null; current.current.onPreviewChange?.(null); draw(); }
    function fit(event) {
      cancelGesture(); s.zoom = .55; s.panX = s.panY = 0;
      const indices = selection();
      if (event?.detail?.selection === true && indices.length) {
        let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
        for (const i of indices) { minU = Math.min(minU, s.uv[i * 2]); maxU = Math.max(maxU, s.uv[i * 2]); minV = Math.min(minV, s.uv[i * 2 + 1]); maxV = Math.max(maxV, s.uv[i * 2 + 1]); }
        s.zoom = Math.max(.05, Math.min(40, .9 / Math.max(.02, maxU - minU, maxV - minV)));
        const { sizeX, sizeY } = mapping(); s.panX = (.5 - (minU + maxU) / 2) * sizeX; s.panY = (.5 - (minV + maxV) / 2) * sizeY;
      }
      draw();
    }
    function action(event) {
      const p = current.current, { kind, value } = event.detail || {};
      if (p.suspended) return;
      if (kind === 'frame') return fit();
      const indices = selection(), all = eligible(), allowed = new Set(all);
      if (kind === 'select-all') return p.onSelectVertices?.(all);
      if (kind === 'select-none') return p.onSelectVertices?.([]);
      if (kind === 'select-invert') { const selected = new Set(indices); return p.onSelectVertices?.(all.filter(i => !selected.has(i))); }
      if (kind === 'select-connected') return p.onSelectVertices?.(connectedVertices(new Uint16Array(eligibleUVFaces(p.geoset, all, p.uvSet).flat()), indices).filter(i => allowed.has(i)));
      if (!indices.length || !['flip-u', 'flip-v', 'rotate', 'scale', 'move', 'translate', 'collapse', 'fold'].includes(kind)) return;
      cancelGesture(); const uv = new Float32Array(s.uv), center = centerOf(indices), angle = (value ?? 90) * Math.PI / 180;
      if (kind === 'collapse' || kind === 'fold') {
        const changed = kind === 'collapse' ? collapseUVCoordinates(uv, indices) : foldUVCoordinates(uv, indices, value || 'right-to-left');
        s.uv = changed; p.onChange?.(restrictUVChange(p.geoset, p.uvSet, changed, indices)); draw(); return;
      }
      for (const index of indices) {
        const offset = index * 2, u = uv[offset] - center[0], v = uv[offset + 1] - center[1];
        if (kind === 'flip-u') uv[offset] = center[0] - u;
        if (kind === 'flip-v') uv[offset + 1] = center[1] - v;
        if (kind === 'rotate') { uv[offset] = center[0] + u * Math.cos(angle) - v * Math.sin(angle); uv[offset + 1] = center[1] + u * Math.sin(angle) + v * Math.cos(angle); }
        if (kind === 'scale') { uv[offset] = center[0] + u * (Array.isArray(value) ? value[0] : value); uv[offset + 1] = center[1] + v * (Array.isArray(value) ? value[1] : value); }
        if (kind === 'move' || kind === 'translate') { uv[offset] += value[0]; uv[offset + 1] += value[1]; }
      }
      if ([...uv].some(v => !Number.isFinite(v))) return;
      s.uv = uv; p.onChange?.(restrictUVChange(p.geoset, p.uvSet, uv, indices)); draw();
    }
    function wheel(event, sensitivity) {
      event.preventDefault(); if (s.drag) return;
      const { x, y } = point(event), before = mapping(); s.zoom = Math.max(.05, Math.min(40, s.zoom * Math.exp(-wheelPixels(event) * .0015 * sensitivity))); const after = mapping();
      s.panX += x - (after.x + (x - before.x) / before.sizeX * after.sizeX); s.panY += y - (after.y + (y - before.y) / before.sizeY * after.sizeY); draw();
    }
    const contextMenu = event => event.preventDefault();
    const cancelKey = event => { if (event.key === 'Escape' && s.drag) { cancelGesture(); event.preventDefault(); } };
    const unbindScroll = bindScrollSensitivity(element, {
      getPreferences: () => current.current.preferences,
      onChange: value => current.current.onSensitivityChange?.(value),
      onPointerChange: value => current.current.onPointerSensitivityChange?.(value),
      onWheelModeChange: value => current.current.onWheelModeChange?.(value),
      // Cancel and restore any drag started by the held left button before it can commit.
      onPointerAdjustment: () => cancelGesture(),
      onCameraModeToggle: () => current.current.onCameraModeToggle?.(),
      onIndicator: setAdjustingSensitivity,
      onWheel: wheel,
    });
    element.addEventListener('pointerdown', pointerDown); element.addEventListener('pointermove', pointerMove); element.addEventListener('pointerup', pointerUp); element.addEventListener('pointercancel', cancelGesture); element.addEventListener('contextmenu', contextMenu);
    ownerDocument.addEventListener('visibilitychange', draw);
    window.addEventListener('mdlvis-frame', fit); window.addEventListener('mdlvis-uv-action', action); ownerWindow.addEventListener('keydown', cancelKey);
    return () => {
      observer.disconnect(); unbindScroll(); s.draw = () => {}; s.resize = null; ownerDocument.removeEventListener('visibilitychange', draw);
      element.removeEventListener('pointerdown', pointerDown); element.removeEventListener('pointermove', pointerMove); element.removeEventListener('pointerup', pointerUp); element.removeEventListener('pointercancel', cancelGesture); element.removeEventListener('contextmenu', contextMenu);
      window.removeEventListener('mdlvis-frame', fit); window.removeEventListener('mdlvis-uv-action', action); ownerWindow.removeEventListener('keydown', cancelKey);
    };
  }, []);
  useEffect(() => { state.current.resize?.(); }, [graphics.pixelRatio, suspended, graphics.pauseWhenHidden]);
  useEffect(() => { setAdjustingSensitivity(null); }, [preferences?.wheelMode]);

  return <div className="uv-editor" ref={host} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 180, overflow: 'hidden', background: visualOptions(preferences).background }}>
    <canvas ref={canvas} tabIndex={0} aria-label="UV coordinate editor" style={{ display: 'block', outline: 'none', touchAction: 'none', cursor: viewportCursor(cameraMode, transformMode) }} />
    {adjustingSensitivity !== null && <div role="status" style={sensitivityIndicatorStyle}>{sensitivityIndicatorText(adjustingSensitivity)}</div>}
    {!count && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#eee', pointerEvents: 'none', fontSize: 12 }}>Select a geoset with texture coordinates.</div>}
    {imageError && <div role="status" style={{ position: 'absolute', bottom: 4, left: 5, color: '#fff0cb', fontSize: 11, pointerEvents: 'none' }}>Texture unavailable.</div>}
  </div>;
}

