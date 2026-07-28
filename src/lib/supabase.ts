import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase ist nicht konfiguriert. Bitte .env.local aus .env.example erstellen ' +
      'und VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY setzen.',
  );
}

export const isSupabaseConfigured = Boolean(url && anonKey);

// createClient benötigt eine gültig geformte URL. Solange kein echtes Projekt
// hinterlegt ist, verwenden wir einen Platzhalter, damit die App (inkl.
// Login-Seite mit Warnhinweis) trotzdem lädt statt beim Start abzustürzen.
export const supabase = createClient<Database>(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
