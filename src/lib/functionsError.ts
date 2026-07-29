// supabase-js wirft bei einem Fehlerstatus nur eine generische Meldung
// ("Edge Function returned a non-2xx status code") und legt die eigentliche
// Fehlerantwort der Funktion im .context-Response ab. Ohne dieses Auslesen
// sieht der Nutzer nie, was die Funktion tatsächlich gemeldet hat.
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === 'string') return body.error;
    } catch {
      // Antwort war kein JSON – generische Meldung verwenden.
    }
  }
  return error instanceof Error ? error.message : fallback;
}
