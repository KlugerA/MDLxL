import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openDetachedUVWindow, UV_WINDOW_NAME } from '../app/detached-window.js';

test('UV opens one named about:blank child window that can close independently', () => {
  let request, focused = 0;
  const child = { focus: () => { focused++; } };
  const result = openDetachedUVWindow({ open: (...args) => { request = args; return child; } });
  assert.equal(result, child); assert.equal(focused, 1);
  assert.deepEqual(request.slice(0, 2), ['about:blank', UV_WINDOW_NAME]);
  assert.match(request[2], /popup=yes/);
  const shell = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  assert.match(shell, /frameName==='MDLxL-UV'/);
  assert.match(shell, /parent:current,modal:false/);
  const preview = readFileSync(new URL('../app/GamePreview.jsx', import.meta.url), 'utf8');
  assert.match(preview, /detachedPreview[\s\S]*ownerWindow\.setTimeout/);
  assert.match(preview, /request: requestPreviewFrame/);
  assert.match(preview, /paused: \(\) => latest\.current\.suspended \|\| \(ownerDocument === document && ownerDocument\.hidden/);
});
