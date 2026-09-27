export const sensitivityValue = value => Math.max(.1, Math.min(10, Number.isFinite(Number(value)) ? Number(value) : 2));
export const pointerSensitivityValue = value => Math.max(.01, Math.min(4, Number.isFinite(Number(value)) ? Number(value) : 1));
export const graphicsOptions = preferences => ({ pixelRatio: 1.5, antialias: false, maxFps: 60, textures: true, lighting: true, particles: true, pauseWhenHidden: true, ...preferences?.graphics });
export const wheelPixels = event => event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1);
export const wheelMode = preferences => ['scroll', 'pointer'].includes(preferences?.wheelMode) ? preferences.wheelMode : 'rotate';
// Three's GridHelper starts in XZ; Warcraft models use Z as the vertical axis.
export const gridRotation = (workplane = 'xy') => workplane === 'yz' ? [0, 0, Math.PI / 2] : workplane === 'xz' ? [0, 0, 0] : [Math.PI / 2, 0, 0];
/** Scale movement from its gesture origin, never the coordinates used for picking. */
export const pointerDragPoint = (start, end, sensitivity) => ({ ...end, x: start.x + (end.x - start.x) * pointerSensitivityValue(sensitivity), y: start.y + (end.y - start.y) * pointerSensitivityValue(sensitivity) });
export const sensitivityIndicatorText = indicator => `${indicator.kind === 'pointer' ? 'Mouse DPI / pointer speed' : 'Scroll sensitivity'}: ${indicator.value.toFixed(2)}×${indicator.reset ? ' · reset' : indicator.shortcut ? indicator.kind === 'pointer' ? ' · release left button to use it' : ' · release right button to zoom' : ''}`;

/** Keeps the last wheel adjustment immediately available, before React commits it. */
export function createScrollSensitivity({ getPreferences, onChange, onPointerChange, onPointerAdjustment, onCameraModeToggle, onIndicator = () => {} }) {
  let rightDown = false, leftPointer = null, pointerAdjustmentPointer = null, middlePointer = null, dpiResetLatched = false, scrollResetLatched = false, external, externalPointer, value = 2, pointerValue = 1;
  function sync() {
    const preferences = getPreferences(), next = preferences?.scrollSensitivity, nextPointer = preferences?.pointerSensitivity;
    if (next !== external) { external = next; value = sensitivityValue(next); }
    if (nextPointer !== externalPointer) { externalPointer = nextPointer; pointerValue = pointerSensitivityValue(nextPointer); }
  }
  return {
    pointerDown(event) {
      if (event.button === 0) {
        leftPointer = { id: event.pointerId };
        if (rightDown && !scrollResetLatched) {
          // Right held, then left clicked: reset the live zoom/scroll speed
          // without starting a selection or transform gesture.
          scrollResetLatched = true; value = 2; pointerAdjustmentPointer = null; onChange?.(value); onPointerAdjustment?.(event);
          event.preventDefault?.(); event.stopImmediatePropagation?.(); onIndicator({ kind: 'scroll', value, shortcut: true, reset: true }); return;
        }
      }
      if (event.button === 2) {
        rightDown = true;
        if (leftPointer !== null && !dpiResetLatched) {
          // Left held, then right clicked: return DPI to normal immediately.
          dpiResetLatched = true; pointerValue = 1; pointerAdjustmentPointer = null; onPointerChange?.(pointerValue); onPointerAdjustment?.(event);
          event.preventDefault?.(); event.stopImmediatePropagation?.(); onIndicator({ kind: 'pointer', value: pointerValue, shortcut: true, reset: true }); return;
        }
      }
      if (event.button === 1 && (getPreferences()?.cameraBindings?.middle ?? 'toggle') === 'toggle') {
        // Original MDLVis toggles Rotation/Work on middle-button release.
        // Consume the down event so OrbitControls and browser autoscroll stay idle.
        middlePointer = { id: event.pointerId, rotation: wheelMode(getPreferences()) === 'rotate' };
        event.preventDefault?.(); event.stopImmediatePropagation?.();
      }
    },
    // Pointer Events fire pointerdown only when the first mouse button is
    // pressed. mousedown is required to see the second button in a chord.
    mouseDown(event) {
      if (event.button === 0 && rightDown && !scrollResetLatched) {
        scrollResetLatched = true; value = 2; pointerAdjustmentPointer = null; onChange?.(value); onPointerAdjustment?.(event);
        event.preventDefault?.(); event.stopImmediatePropagation?.(); onIndicator({ kind: 'scroll', value, shortcut: true, reset: true });
      }
      if (event.button === 2) {
        rightDown = true;
        if (leftPointer !== null && !dpiResetLatched) {
          dpiResetLatched = true; pointerValue = 1; pointerAdjustmentPointer = null; onPointerChange?.(pointerValue); onPointerAdjustment?.(event);
          event.preventDefault?.(); event.stopImmediatePropagation?.(); onIndicator({ kind: 'pointer', value: pointerValue, shortcut: true, reset: true });
        }
      }
    },
    pointerUp(event) {
      if (event.type === 'pointercancel' || event.type === 'blur') { middlePointer = null; leftPointer = null; pointerAdjustmentPointer = null; rightDown = false; dpiResetLatched = false; scrollResetLatched = false; onIndicator(null); return; }
      if (event.button === 0 && (!leftPointer || leftPointer.id === event.pointerId || event.type === 'mouseup')) { leftPointer = null; pointerAdjustmentPointer = null; scrollResetLatched = false; onIndicator(null); }
      if (event.button === 2) { rightDown = false; dpiResetLatched = false; onIndicator(null); }
      if (event.button === 1 && middlePointer && middlePointer.id === event.pointerId) {
        const toggle = middlePointer.rotation && wheelMode(getPreferences()) === 'rotate'; middlePointer = null;
        if (toggle) onCameraModeToggle?.();
      }
    },
    wheel(event) {
      sync();
      const preferences = getPreferences(), mode = wheelMode(preferences);
      const rightShortcut = preferences?.rightScrollAdjust !== false && (rightDown || Boolean(event.buttons & 2));
      const leftShortcut = leftPointer !== null || Boolean(event.buttons & 1);
      // Held-button gestures are temporary overrides; toolbar modes persist independently.
      const kind = leftShortcut ? 'pointer' : rightShortcut ? 'scroll' : mode === 'pointer' ? 'pointer' : mode === 'scroll' ? 'scroll' : null;
      if (kind) {
        event.preventDefault(); event.stopImmediatePropagation();
        const factor = Math.exp(-Math.max(-400, Math.min(400, wheelPixels(event))) * .002);
        if (kind === 'pointer') {
          const adjustmentPointer = leftPointer?.id ?? 'external-left-button';
          if (pointerAdjustmentPointer !== adjustmentPointer) { pointerAdjustmentPointer = adjustmentPointer; onPointerAdjustment?.(event); }
          let nextPointer = Math.round(pointerSensitivityValue(pointerValue * factor) * 100) / 100;
          // A normal wheel tick must also escape the 0.01x floor; rounding
          // 0.01 * 1.22 back to 0.01 would otherwise trap the control there.
          if (nextPointer === pointerValue && wheelPixels(event) !== 0) nextPointer = Math.round(pointerSensitivityValue(pointerValue + (wheelPixels(event) < 0 ? .01 : -.01)) * 100) / 100;
          pointerValue = nextPointer; onPointerChange?.(pointerValue);
        }
        else { value = Math.round(sensitivityValue(value * factor) * 100) / 100; onChange?.(value); }
        onIndicator({ kind, value: kind === 'pointer' ? pointerValue : value, shortcut: kind === 'pointer' ? leftShortcut : Boolean(rightShortcut) });
        return { adjusting: true, sensitivity: value, pointerSensitivity: pointerValue, kind };
      }
      pointerAdjustmentPointer = null;
      return { adjusting: false, sensitivity: value };
    },
  };
}

/** Capture intercepts adjustment wheels before OrbitControls can zoom or pan. */
export function bindScrollSensitivity(element, options) {
  let indicatorTimer;
  const ownerWindow = element.ownerDocument?.defaultView || window;
  const controller = createScrollSensitivity({ ...options, onIndicator: value => {
    clearTimeout(indicatorTimer); options.onIndicator?.(value);
    if (value && options.onIndicator) indicatorTimer = setTimeout(() => options.onIndicator(null), 1400);
  } });
  const wheel = event => { const result = controller.wheel(event); if (!result.adjusting) options.onWheel?.(event, result.sensitivity); };
  const pointerDown = event => { if (event.button === 1) element.focus(); controller.pointerDown(event); };
  const mouseDown = event => controller.mouseDown(event);
  const mouseUp = event => controller.pointerUp(event);
  const auxiliaryClick = event => { if (event.button === 1) event.preventDefault(); };
  element.addEventListener('pointerdown', pointerDown, true);
  element.addEventListener('mousedown', mouseDown, true);
  ownerWindow.addEventListener('pointerup', controller.pointerUp, true);
  ownerWindow.addEventListener('mouseup', mouseUp, true);
  ownerWindow.addEventListener('pointercancel', controller.pointerUp, true);
  ownerWindow.addEventListener('blur', controller.pointerUp);
  element.addEventListener('wheel', wheel, { capture: true, passive: false });
  element.addEventListener('auxclick', auxiliaryClick);
  return () => {
    clearTimeout(indicatorTimer);
    element.removeEventListener('pointerdown', pointerDown, true);
    element.removeEventListener('mousedown', mouseDown, true);
    ownerWindow.removeEventListener('pointerup', controller.pointerUp, true);
    ownerWindow.removeEventListener('mouseup', mouseUp, true);
    ownerWindow.removeEventListener('pointercancel', controller.pointerUp, true);
    ownerWindow.removeEventListener('blur', controller.pointerUp);
    element.removeEventListener('wheel', wheel, true);
    element.removeEventListener('auxclick', auxiliaryClick);
  };
}

/** No frame callbacks remain queued while static or suspended. */
export function createRenderScheduler({ render, continuous, paused, maxFps, request = requestAnimationFrame, cancel = cancelAnimationFrame }) {
  let frame = null, disposed = false, dirty = 1, previous = null, idle = true;
  function schedule() { if (!disposed && frame === null && !paused() && (dirty || continuous())) frame = request(tick); }
  function tick(now) {
    frame = null;
    if (disposed || paused()) { previous = null; idle = true; return; }
    const interval = 1000 / (maxFps() || 60), elapsed = previous === null ? interval : now - previous;
    if (previous === null || elapsed >= interval - .5) {
      dirty = Math.max(0, dirty - 1);
      const delta = idle || previous === null ? 0 : Math.min(100, elapsed); previous = now; idle = false;
      if (render(now, delta) === false) { dispose(); return; }
    }
    schedule();
    if (frame === null) idle = true;
  }
  function invalidate() { dirty = Math.max(dirty, 1); schedule(); }
  // The compositor can replace a resized drawing surface after its first
  // frame. Render once more at the frame cap, then return static views to idle.
  function resize() { dirty = Math.max(dirty, 2); schedule(); }
  function sync() {
    if (paused()) { if (frame !== null) cancel(frame); frame = null; previous = null; idle = true; dirty = Math.max(dirty, 1); }
    else invalidate();
  }
  function dispose() { disposed = true; if (frame !== null) cancel(frame); frame = null; }
  return { invalidate, resize, sync, dispose };
}

export const sensitivityIndicatorStyle = { position: 'absolute', top: 32, left: 5, padding: '4px 7px', background: '#f1f5ed', border: '1px solid #527742', color: '#215316', fontSize: 11, pointerEvents: 'none', zIndex: 2 };

