import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import routing from '../electron/external-model-open.cjs';

test('desktop launch arguments resolve only unique model and paint paths in order', () => {
  const root=path.resolve('C:/Models'), absolute=path.resolve(root,'Second.mdx');
  assert.deepEqual(routing.modelPathsFromArguments(['.', 'First.mdl', absolute, 'FIRST.MDL', '--flag', 'notes.txt'],root),[
    path.resolve(root,'First.mdl'),
    absolute,
  ]);
});
