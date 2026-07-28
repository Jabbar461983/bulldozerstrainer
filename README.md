# Bulldozers Junioren Manager

PWA zur Strukturierung der Juniorenabteilung des Streethockeyclub Bulldozers
Kernenried-Zauggenried: Teamverwaltung, Finanzen, Training, Spiele sowie
Spieler- und Trainerdaten. Mobile-first (primäre Nutzung: Smartphone am
Spielfeldrand), installierbar, mit Light-/Dark-Mode.

Status: iterativer Aufbau nach Konzept. Aktueller Stand siehe unten.

## Tech-Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- React Router
- Supabase (Auth, Postgres, Storage) als Backend
- `vite-plugin-pwa` für Manifest/Service-Worker/Offline-Caching

## Setup

```bash
npm install
cp .env.example .env.local   # Supabase-URL + Anon-Key eintragen
npm run dev
```

### Supabase-Projekt einrichten

1. Projekt auf [supabase.com](https://supabase.com) anlegen.
2. SQL-Migrationen aus `supabase/migrations/` in der angegebenen Reihenfolge
   im SQL-Editor ausführen (oder via Supabase CLI: `supabase db push`).
3. `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` in `.env.local` eintragen.
4. Ersten Admin-Account anlegen: Supabase Dashboard → Authentication → Add
   user, danach in der Tabelle `profiles` das Feld `is_admin` auf `true`
   setzen. Alle weiteren Benutzer können danach über die App (Benutzer­
   verwaltung) angelegt werden.
5. Edge Functions deployen (werden für Anlegen/Löschen von Benutzer-Logins
   durch die Userverwaltung benötigt):
   ```bash
   supabase functions deploy admin-create-user
   supabase functions deploy admin-delete-user
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` stehen
   Edge Functions automatisch als Umgebungsvariablen zur Verfügung, es ist
   keine zusätzliche Konfiguration nötig.

## Datenmodell

Siehe `supabase/migrations/0001_init.sql` für das vollständige Schema
(Profile/Rollen, Teams/Kategorien, Spieler/Trainer, Übungen, Training,
Spiele, Finanzen) und `0002_rls.sql` für die Rechtematrix (Row Level
Security): Admin hat vollen Zugriff, Headcoach/Assistenzcoach nur auf
zugewiesene Teams; Finanzen ist Assistenzcoaches nicht zugänglich.

## Benutzerverwaltung

Unter „Benutzer“ (nur für Admins sichtbar) können neue Trainer-/Admin-Konten
angelegt werden. Der neue Benutzer erhält eine Einladungs-E-Mail von Supabase
und vergibt darüber sein eigenes Passwort. Team- und Rollenzuweisungen
(Headcoach/Assistenzcoach je Team) sowie der Admin-Status lassen sich
jederzeit bearbeiten; das Löschen eines Kontos entfernt Auth-User, Profil und
alle Rollen-Zuweisungen unwiderruflich. Das Anlegen/Löschen von Logins läuft
über die beiden Edge Functions in `supabase/functions/`, da dafür der
Service-Role-Key nötig ist, der niemals im Client landen darf.

## Ausbau-Roadmap

1. ✅ PWA-Grundgerüst, Backend-Anbindung, Auth
2. ✅ Rollen- & Berechtigungssystem inkl. Userverwaltung
3. ✅ Teamverwaltung
4. ✅ Modul Spieler & Trainer (CSV-Import)
5. ✅ Modul Übungen (Übungsdatenbank)
6. ✅ Modul Training (Serienbuchung, Zeitbalken, Bewertung); Offline-Fähigkeit folgt in Schritt 9
7. Modul Spiele (Aufstellung, Bewertung, Kommentare)
8. Modul Finanzen (Budget, Belege, Journal, Exporte)
9. Offline-Sync-Layer & PWA-Feinschliff
10. ✅ Design-Politur (Vereinslogo & -farben eingebunden), Responsive/Touch-Feinschliff folgt laufend

## Design/Theme

Original-Vereinslogo liegt unter `public/logo-bulldozers_farbig.png` und wird
in Login-Seite und App-Header verwendet. Favicon (`public/favicon-32.png`,
`favicon-48.png`) und PWA-Icons (`public/icons/icon-192.png`,
`icon-512.png`) sind daraus exportiert (weißer Hintergrund, damit sie auch
als maskierbares Android-Icon funktionieren). Die Vereinsfarben Dunkelgrün
`#007057` und Gold `#ba990e` wurden direkt aus dem Logo gesampelt und sind
als CSS-Variablen mit Präfix `--club-` in `src/index.css` zentralisiert.
