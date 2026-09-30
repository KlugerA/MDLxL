import test from 'node:test';
import assert from 'node:assert/strict';
import close from '../electron/model-close.cjs';

test('a saved model with no known changes closes without a prompt', () => {
  assert.equal(close.needsModelClosePrompt({ dirty: false, saved: true }), false);
});

test('changed and never-saved models require the Save, Cancel, Close prompt', () => {
  for (const state of [{ dirty: true, saved: true }, { dirty: false, saved: false }]) {
    assert.equal(close.needsModelClosePrompt(state), true);
    const prompt = close.modelClosePrompt({ ...state, name: 'Footman.mdx' });
    assert.deepEqual(prompt.buttons, ['Save', 'Cancel', 'Close']);
    assert.equal(prompt.defaultId, 0);
    assert.equal(prompt.cancelId, 1);
  }
});

test('legacy dirty updates preserve whether the model was saved', () => {
  assert.deepEqual(close.normalizeModelCloseState(true, { dirty: false, saved: true }), { dirty: true, saved: true });
  assert.deepEqual(close.normalizeModelCloseState({ dirty: false, saved: false }, { dirty: true, saved: true }), { dirty: false, saved: false });
});

test('the native button order maps to save, cancel, and close', () => {
  assert.deepEqual([0, 1, 2].map(close.modelCloseAction), ['save', 'cancel', 'close']);
});
