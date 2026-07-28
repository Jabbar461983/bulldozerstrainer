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
   setzen (die weitere Benutzerverwaltung über die App-UI folgt in Schritt 2).

## Datenmodell

Siehe `supabase/migrations/0001_init.sql` für das vollständige Schema
(Profile/Rollen, Teams/Kategorien, Spieler/Trainer, Übungen, Training,
Spiele, Finanzen) und `0002_rls.sql` für die Rechtematrix (Row Level
Security): Admin hat vollen Zugriff, Headcoach/Assistenzcoach nur auf
zugewiesene Teams; Finanzen ist Assistenzcoaches nicht zugänglich.

## Ausbau-Roadmap

1. ✅ PWA-Grundgerüst, Backend-Anbindung, Auth
2. Rollen- & Berechtigungssystem inkl. Userverwaltung
3. Teamverwaltung
4. Modul Spieler & Trainer (Excel-Import)
5. Modul Übungen (Übungsdatenbank)
6. Modul Training (Serienbuchung, Zeitbalken, Bewertung, offline-first)
7. Modul Spiele (Aufstellung, Bewertung, Kommentare)
8. Modul Finanzen (Budget, Belege, Journal, Exporte)
9. Offline-Sync-Layer & PWA-Feinschliff
10. Design-Politur (Feinschliff Vereinslogo, Responsive/Touch)

## Design/Theme

Vereinsfarben (Dunkelgrün `#0b5d36` / Gold `#b8952e`) sind als CSS-Variablen
mit Präfix `--club-` in `src/index.css` zentralisiert. Das Logo
(`public/logo.svg`, daraus abgeleitet `public/favicon.svg` und
`public/icons/icon-*.png`) ist aktuell eine anhand der Vorlage von Hand
nachgebaute Vektor-Version, da die Originaldatei in dieser Session nicht als
Datei verfügbar war. Sobald die Originaldatei (z. B. als hochauflösendes
PNG/SVG) eingecheckt werden kann, einfach `public/logo.svg` ersetzen und die
Icons in `public/icons/` neu daraus exportieren – der Rest der App verweist
nur auf diese Pfade.
