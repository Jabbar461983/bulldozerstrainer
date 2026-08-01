function detectDelimiter(firstLine: string): ',' | ';' {
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

function escapeCsvField(value: string): string {
  if (/[";\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map((cell) => escapeCsvField(String(cell))).join(';')).join('\r\n');
}

export function parseCsv(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLineEnd = normalized.indexOf('\n');
  const firstLine = firstLineEnd === -1 ? normalized : normalized.slice(0, firstLineEnd);
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function parseDateCell(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const deMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (deMatch) {
    const [, d, m, y] = deMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

export class CsvFormatError extends Error {}

export interface RosterImportRow {
  firstName: string;
  lastName: string;
  birthdate: string | null;
  rawBirthdate: string;
  rawCategory: string;
  rawTeam: string;
  valid: boolean;
  error?: string;
}

const FIRST_NAME_HEADERS = ['vorname', 'first name', 'firstname'];
const LAST_NAME_HEADERS = ['nachname', 'last name', 'lastname'];
const BIRTHDATE_HEADERS = ['geburtsdatum', 'geburtstag', 'birthdate'];
const CATEGORY_HEADERS = ['kategorie', 'category'];
const TEAM_HEADERS = ['team', 'mannschaft'];

export function parseRosterCsv(text: string): RosterImportRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new CsvFormatError('Die Datei enthält keine Daten.');
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const firstNameIdx = header.findIndex((h) => FIRST_NAME_HEADERS.includes(h));
  const lastNameIdx = header.findIndex((h) => LAST_NAME_HEADERS.includes(h));
  const birthdateIdx = header.findIndex((h) => BIRTHDATE_HEADERS.includes(h));
  const categoryIdx = header.findIndex((h) => CATEGORY_HEADERS.includes(h));
  const teamIdx = header.findIndex((h) => TEAM_HEADERS.includes(h));

  if (firstNameIdx === -1 || lastNameIdx === -1) {
    throw new CsvFormatError(
      'Die Datei benötigt mindestens die Spalten "Vorname" und "Nachname" (erste Zeile = Überschriften).',
    );
  }

  return rows.slice(1).map((cols) => {
    const firstName = (cols[firstNameIdx] ?? '').trim();
    const lastName = (cols[lastNameIdx] ?? '').trim();
    const rawBirthdate = birthdateIdx === -1 ? '' : (cols[birthdateIdx] ?? '').trim();
    const birthdate = rawBirthdate ? parseDateCell(rawBirthdate) : null;
    const rawCategory = categoryIdx === -1 ? '' : (cols[categoryIdx] ?? '').trim();
    const rawTeam = teamIdx === -1 ? '' : (cols[teamIdx] ?? '').trim();
    const valid = firstName.length > 0 && lastName.length > 0;
    return {
      firstName,
      lastName,
      birthdate,
      rawBirthdate,
      rawCategory,
      rawTeam,
      valid,
      error: valid ? undefined : 'Vorname/Nachname fehlt',
    };
  });
}

export interface ExerciseImportRow {
  title: string;
  learningContent: string;
  description: string;
  variants: string;
  rawFocusAreas: string;
  rawCategories: string;
  valid: boolean;
  error?: string;
}

const EXERCISE_TITLE_HEADERS = ['titel', 'title'];
const LEARNING_CONTENT_HEADERS = ['lerninhalte', 'lerninhalt', 'learning content'];
const EXERCISE_DESCRIPTION_HEADERS = ['beschreibung', 'description'];
const VARIANTS_HEADERS = ['varianten', 'variants'];
const FOCUS_AREA_HEADERS = ['fokus-bereiche', 'fokusbereiche', 'fokus', 'inhalte', 'inhalt', 'focus areas', 'focus'];
const EXERCISE_CATEGORY_HEADERS = [
  'alterskategorien',
  'alterskategorie',
  'kategorien',
  'kategorie',
  'categories',
  'category',
];

export function parseExerciseCsv(text: string): ExerciseImportRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new CsvFormatError('Die Datei enthält keine Daten.');
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const titleIdx = header.findIndex((h) => EXERCISE_TITLE_HEADERS.includes(h));
  const learningContentIdx = header.findIndex((h) => LEARNING_CONTENT_HEADERS.includes(h));
  const descriptionIdx = header.findIndex((h) => EXERCISE_DESCRIPTION_HEADERS.includes(h));
  const variantsIdx = header.findIndex((h) => VARIANTS_HEADERS.includes(h));
  const focusIdx = header.findIndex((h) => FOCUS_AREA_HEADERS.includes(h));
  const categoryIdx = header.findIndex((h) => EXERCISE_CATEGORY_HEADERS.includes(h));

  if (titleIdx === -1) {
    throw new CsvFormatError('Die Datei benötigt mindestens die Spalte "Titel" (erste Zeile = Überschriften).');
  }

  return rows.slice(1).map((cols) => {
    const title = (cols[titleIdx] ?? '').trim();
    const learningContent = learningContentIdx === -1 ? '' : (cols[learningContentIdx] ?? '').trim();
    const description = descriptionIdx === -1 ? '' : (cols[descriptionIdx] ?? '').trim();
    const variants = variantsIdx === -1 ? '' : (cols[variantsIdx] ?? '').trim();
    const rawFocusAreas = focusIdx === -1 ? '' : (cols[focusIdx] ?? '').trim();
    const rawCategories = categoryIdx === -1 ? '' : (cols[categoryIdx] ?? '').trim();
    const valid = title.length > 0;
    return {
      title,
      learningContent,
      description,
      variants,
      rawFocusAreas,
      rawCategories,
      valid,
      error: valid ? undefined : 'Titel fehlt',
    };
  });
}

function parseTimeCell(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, h, m] = match;
  return `${h.padStart(2, '0')}:${m}`;
}

export interface FixtureImportRow {
  date: string | null;
  rawDate: string;
  time: string | null;
  location: string;
  homeTeam: string;
  awayTeam: string;
  season: string;
  valid: boolean;
  error?: string;
}

const DATE_HEADERS = ['datum', 'date'];
const TIME_HEADERS = ['zeit', 'time', 'uhrzeit'];
const LOCATION_HEADERS = ['ort', 'location', 'spielort'];
const HOME_HEADERS = ['heim', 'heimteam', 'home', 'home team'];
const AWAY_HEADERS = ['gast', 'gastteam', 'away', 'away team', 'auswärts'];
const SEASON_HEADERS = ['saison', 'season'];

export function parseFixtureCsv(text: string): FixtureImportRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new CsvFormatError('Die Datei enthält keine Daten.');
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const dateIdx = header.findIndex((h) => DATE_HEADERS.includes(h));
  const timeIdx = header.findIndex((h) => TIME_HEADERS.includes(h));
  const locationIdx = header.findIndex((h) => LOCATION_HEADERS.includes(h));
  const homeIdx = header.findIndex((h) => HOME_HEADERS.includes(h));
  const awayIdx = header.findIndex((h) => AWAY_HEADERS.includes(h));
  const seasonIdx = header.findIndex((h) => SEASON_HEADERS.includes(h));

  if (dateIdx === -1 || homeIdx === -1 || awayIdx === -1) {
    throw new CsvFormatError(
      'Die Datei benötigt mindestens die Spalten "Datum", "Heim" und "Gast" (erste Zeile = Überschriften).',
    );
  }

  return rows.slice(1).map((cols) => {
    const rawDate = (cols[dateIdx] ?? '').trim();
    const date = parseDateCell(rawDate);
    const homeTeam = (cols[homeIdx] ?? '').trim();
    const awayTeam = (cols[awayIdx] ?? '').trim();
    const time = timeIdx === -1 ? null : parseTimeCell((cols[timeIdx] ?? '').trim());
    const location = locationIdx === -1 ? '' : (cols[locationIdx] ?? '').trim();
    const season = seasonIdx === -1 ? '' : (cols[seasonIdx] ?? '').trim();
    const valid = Boolean(date) && homeTeam.length > 0 && awayTeam.length > 0;
    return {
      date,
      rawDate,
      time,
      location,
      homeTeam,
      awayTeam,
      season,
      valid,
      error: valid ? undefined : 'Datum/Heim/Gast fehlt oder Datum ungültig',
    };
  });
}
