// Supabase Storage lehnt Object-Keys mit Umlauten/Sonderzeichen ab
// ("Invalid key"). Für den sichtbaren Titel/Dateinamen in UI und Datenbank
// spielt das keine Rolle - nur der tatsächliche Speicherpfad muss reines
// ASCII sein. Deutsche Umlaute/ß werden transliteriert, alles andere
// Nicht-ASCII (z.B. andere Akzente) wird entfernt statt den Upload
// fehlschlagen zu lassen.
export function sanitizeForStorageKey(text: string, maxLength = 80): string {
  const cleaned = text
    .replace(/ä/g, 'ae')
    .replace(/Ä/g, 'Ae')
    .replace(/ö/g, 'oe')
    .replace(/Ö/g, 'Oe')
    .replace(/ü/g, 'ue')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9 _.-]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  return cleaned.slice(0, maxLength);
}
