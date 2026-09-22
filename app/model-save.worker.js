import { EditorDocument } from '../src/editor-document.js';
import { prepareModelSave } from '../src/save-target.js';

self.onmessage = ({ data: { snapshot, format, name } }) => {
  let doc;
  try {
    doc = EditorDocument.restoreRecoveryState(snapshot);
    const result = prepareModelSave(doc, format, name);
    self.postMessage({ ...result, timings: doc.lastSaveTimings }, [result.bytes.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message, timings: doc?.lastSaveTimings });
  }
};
