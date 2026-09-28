import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStarterDocument } from '../src/starter-model.js';

const {validateOptimizeXLCopies}=createRequire(import.meta.url)(process.env.MDLXL_OPTIMIZEXL_VALIDATOR||'../dist/optimizexl-validation.cjs');
test('bundled desktop validation reopens both Classic copies without changing bytes',()=>{
  const before=createStarterDocument().serialize('mdx'),after=new Uint8Array(before),original=new Uint8Array(before);
  assert.doesNotThrow(()=>validateOptimizeXLCopies({before,after}));assert.deepEqual(before,original);assert.deepEqual(after,original);
});
test('bundled desktop validation still rejects a malformed or unsupported second copy',()=>{
  const before=createStarterDocument().serialize('mdx');
  assert.throws(()=>validateOptimizeXLCopies({before,after:new Uint8Array([1,2,3])}));
  assert.throws(()=>validateOptimizeXLCopies({before,after:createStarterDocument(1000).serialize('mdx')}),/could not be reopened/);
});
