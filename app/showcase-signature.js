const DATABASE = 'mdlxl-showcase-signatures';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('presets', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('presets', mode);
      const request = operation(transaction.objectStore('presets'));
      let result;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve(result);
    });
  } finally { database.close(); }
}

export const listSignaturePresets = () => transact('readonly', store => store.getAll());
export const saveSignaturePreset = preset => transact('readwrite', store => store.put(preset));
export const deleteSignaturePreset = id => transact('readwrite', store => store.delete(id));
