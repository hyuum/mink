// Saves the app's data on this device. IndexedDB first, localStorage as a fallback,
// and memory only when the browser blocks both (private windows, sandboxed previews).
import type { AppData } from './types';

const DB_NAME = 'matcha-planner';
const STORE = 'kv';
const KEY = 'data';

export type StorageKind = 'indexeddb' | 'localstorage' | 'memory';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, value: AppData): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface Persistence {
  kind: StorageKind;
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
}

export async function createPersistence(): Promise<Persistence> {
  try {
    const db = await openDb();
    return {
      kind: 'indexeddb',
      load: async () => ((await idbGet(db)) as AppData | undefined) ?? null,
      save: (data) => idbPut(db, data),
    };
  } catch {
    /* fall through */
  }
  try {
    const probe = '__planner_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return {
      kind: 'localstorage',
      load: async () => {
        const raw = localStorage.getItem(DB_NAME);
        return raw ? (JSON.parse(raw) as AppData) : null;
      },
      save: async (data) => localStorage.setItem(DB_NAME, JSON.stringify(data)),
    };
  } catch {
    /* fall through */
  }
  return { kind: 'memory', load: async () => null, save: async () => undefined };
}
