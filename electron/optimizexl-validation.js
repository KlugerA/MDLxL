import { openDocument } from '../src/editor-document.js';

// Bundled for Electron main: a portable app cannot resolve renderer codec
// dependencies from a development checkout's node_modules directory.
export function validateOptimizeXLCopies(payload) {
  for (const bytes of [payload.before, payload.after]) {
    const doc = openDocument(new Uint8Array(bytes), 'copy.mdx');
    if (doc.readOnly || doc.model.Version !== 800) throw Error('An OptimizeXL copy could not be reopened.');
  }
}
