export interface QueuedLocationPoint {
  id?: number;
  journey_id: string;
  sequence_number: number;
  client_timestamp: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  speed: number | null;
  heading: number | null;
}

const DB_NAME = 'RakshaSutraOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'journey_location_queue';
const MAX_QUEUE_SIZE = 500;

class OfflineLocationQueue {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('journey_id', 'journey_id', { unique: false });
          store.createIndex('sequence_number', 'sequence_number', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Enqueue a GPS location point. Drops oldest points if capacity exceeds MAX_QUEUE_SIZE (FIFO).
   */
  async enqueue(point: QueuedLocationPoint): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      // Check current count to enforce FIFO cap
      const countReq = store.count();
      countReq.onsuccess = () => {
        if (countReq.result >= MAX_QUEUE_SIZE) {
          // Open cursor to delete oldest entries
          const cursorReq = store.openCursor();
          let deleted = 0;
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor && deleted < 50) {
              cursor.delete();
              deleted++;
              cursor.continue();
            }
          };
        }
        store.add(point);
      };

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[OfflineLocationQueue] Failed to enqueue location point:', err);
    }
  }

  /**
   * Retrieve all pending queued points for a given journey in sequence order.
   */
  async getPendingPoints(journeyId?: string): Promise<QueuedLocationPoint[]> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => {
          let points: QueuedLocationPoint[] = request.result || [];
          if (journeyId) {
            points = points.filter((p) => p.journey_id === journeyId);
          }
          // Sort strictly by sequence_number
          points.sort((a, b) => a.sequence_number - b.sequence_number);
          resolve(points);
        };
        request.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  /**
   * Remove successfully uploaded points by their primary IDs.
   */
  async removePoints(ids: number[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const id of ids) {
        store.delete(id);
      }

      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (err) {
      console.warn('[OfflineLocationQueue] Failed to remove points:', err);
    }
  }

  /**
   * Clear all queued points for a journey upon completion or cancellation.
   */
  async clearJourney(journeyId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (cursor.value.journey_id === journeyId) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    } catch (err) {
      console.warn('[OfflineLocationQueue] Clear error:', err);
    }
  }
}

export const offlineLocationQueue = new OfflineLocationQueue();
