import { getCacheEntry, setCacheEntry } from './offlineCache';
import { supabase } from './supabase';

export interface CachedResult<T> {
  data: T;
  fromCache: boolean;
  cachedAt: number | null;
}

async function scopedKey(key: string): Promise<string> {
  // Cache-Einträge nach eingeloggtem Nutzer trennen, damit auf einem geteilten Gerät
  // (z.B. Vereins-Tablet) ein Nutzerwechsel im Offline-Zustand nie die zwischengespeicherten
  // Daten einer anderen Person anzeigt.
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id ?? 'anonymous';
  return `${userId}:${key}`;
}

/**
 * Führt `fetcher` aus und cached das Ergebnis in IndexedDB. Schlägt der Live-Abruf fehl
 * (z.B. offline), wird der zuletzt gecachte Stand unter `key` zurückgegeben, sofern
 * vorhanden. Existiert kein Cache-Eintrag, wird der ursprüngliche Fehler weitergereicht.
 */
export async function withCache<T>(key: string, fetcher: () => Promise<T>): Promise<CachedResult<T>> {
  const cacheKey = await scopedKey(key);
  try {
    const data = await fetcher();
    void setCacheEntry(cacheKey, data);
    return { data, fromCache: false, cachedAt: Date.now() };
  } catch (err) {
    const cached = await getCacheEntry<T>(cacheKey);
    if (cached) {
      return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
    }
    throw err;
  }
}
