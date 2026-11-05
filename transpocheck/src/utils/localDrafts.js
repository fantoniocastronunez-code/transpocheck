const DB_NAME = 'ChecklistDraftsDB';
const STORE_NAME = 'drafts';
const DB_VERSION = 1;

let cachedDB = null;

function getDB() {
  if (cachedDB) return Promise.resolve(cachedDB);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = (e) => {
      cachedDB = e.target.result;
      cachedDB.onclose = () => { cachedDB = null; };
      cachedDB.onversionchange = () => { cachedDB.close(); cachedDB = null; };
      resolve(cachedDB);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function saveLocalDraft(jobId, data) {
  if (!jobId) return;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(data, jobId);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
      tx.onabort = (e) => reject(e.target.error || new Error('Transaction aborted'));
    });
  } catch (e) {
    console.warn('[ERR-LOCAL-DRAFT-SAVE-01] Error saving local draft:', e);
  }
}

export async function getLocalDraft(jobId) {
  if (!jobId) return null;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(jobId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    console.warn('[ERR-LOCAL-DRAFT-GET-01] Error getting local draft:', e);
    return null;
  }
}

export async function deleteLocalDraft(jobId) {
  if (!jobId) return;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(jobId);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    console.warn('[ERR-LOCAL-DRAFT-DEL-01] Error deleting local draft:', e);
  }
}
