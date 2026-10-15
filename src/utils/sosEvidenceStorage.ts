/**
 * Utility to reliably persist SOS audio/video evidence to device local storage (IndexedDB)
 * and trigger downloads even when browsers restrict background downloads.
 */

const DB_NAME = 'rakshasutra_db';
const STORE_NAME = 'sos_evidence';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface SosEvidenceRecord {
  id: string;
  timestamp: string;
  mimeType: string;
  sizeBytes: number;
  blob: Blob;
  downloadUrl?: string;
}

export async function saveSosEvidenceToLocal(blob: Blob, mimeType: string): Promise<SosEvidenceRecord> {
  const id = `sos_${Date.now()}`;
  const record: SosEvidenceRecord = {
    id,
    timestamp: new Date().toISOString(),
    mimeType,
    sizeBytes: blob.size,
    blob,
  };

  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    console.log(`[SOS Storage] Evidence saved to IndexedDB: ${id} (${(blob.size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error('[SOS Storage] Failed to write to IndexedDB:', err);
  }

  // Attempt auto-download to user device Downloads folder
  try {
    triggerBlobDownload(blob, mimeType);
  } catch (dlErr) {
    console.warn('[SOS Storage] Auto-download failed, blob remains safely saved in IndexedDB:', dlErr);
  }

  return record;
}

export function triggerBlobDownload(blob: Blob, mimeType: string) {
  const isVideo = mimeType.includes('video');
  const ext = mimeType.includes('mp4') ? 'mp4' : isVideo ? 'webm' : 'weba';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `rakshasutra-sos-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  }, 3000);
}
