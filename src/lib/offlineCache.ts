import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

const DB_NAME = 'bulldozers-offline-cache';
const STORE_NAME = 'cache';

interface CacheRecord {
  key: string;
  data: unknown;
  cachedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getCacheEntry<T>(key: string): Promise<{ data: T; cachedAt: number } | null> {
  try {
    const db = await getDb();
    const record = (await db.get(STORE_NAME, key)) as CacheRecord | undefined;
    if (!record) return null;
    return { data: record.data as T, cachedAt: record.cachedAt };
  } catch {
    // IndexedDB kann z.B. im privaten Browser-Modus nicht verfügbar sein - Cache ist best-effort.
    return null;
  }
}

export async function setCacheEntry<T>(key: string, data: T): Promise<void> {
  try {
    const db = await getDb();
    const record: CacheRecord = { key, data, cachedAt: Date.now() };
    await db.put(STORE_NAME, record);
  } catch {
    // Best-effort, siehe oben.
  }
}
