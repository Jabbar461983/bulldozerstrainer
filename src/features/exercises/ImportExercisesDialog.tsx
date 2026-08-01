import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Label } from '../../components/Input';
import { parseExerciseCsv, readCsvFile, CsvFormatError, toCsv } from '../../lib/csv';
import type { ExerciseImportRow } from '../../lib/csv';
import { downloadTextFile } from '../../lib/downloadFile';
import { importExercises, EXERCISE_FOCUS_OPTIONS } from './api';
import { useAuth } from '../../auth/AuthContext';
import type { Category, ExerciseFocus } from '../../types/database';

interface ImportExercisesDialogProps {
  categories: Category[];
  onClose: () => void;
  onImported: () => void;
}

function buildExampleCsv(categories: Category[]): string {
  const sample1 = categories[0]?.name ?? 'U9';
  const sample2 = categories[1]?.name ?? categories[0]?.name ?? 'U12';
  const header = ['Titel', 'Lerninhalte', 'Beschreibung', 'Varianten', 'Fokus-Bereiche', 'Alterskategorien'];
  const row1 = [
    'Bälleiburg',
    'Viel Bewegung, Ball führen und kontrollieren',
    'Es werden vier Teams gebildet. Jedes Team hat einen Ring mit Bällen drin.',
    'Anstelle des Zurückführens muss ein Pass in die Homebase gespielt werden',
    'Passspiel,Schuss',
    `${sample1},${sample2}`,
  ];
  const row2 = [
    'Sprintleiter',
    'Schnelligkeit und Beinarbeit',
    'Seitliches und vorwärts Laufen durch die Leiter, danach kurzer Sprint.',
    '',
    'Schnelligkeit,Koordination',
    sample1,
  ];
  return toCsv([header, row1, row2]);
}

function resolveFocusAreas(raw: string): { matched: ExerciseFocus[]; unknown: string[] } {
  const known = new Map(EXERCISE_FOCUS_OPTIONS.map((f) => [f.toLowerCase(), f]));
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const matched: ExerciseFocus[] = [];
  const unknown: string[] = [];
  for (const part of parts) {
    const found = known.get(part.toLowerCase());
    if (found) matched.push(found);
    else unknown.push(part);
  }
  return { matched, unknown };
}

function resolveCategories(raw: string, categories: Category[]): { matched: string[]; unknown: string[] } {
  const known = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const matched: string[] = [];
  const unknown: string[] = [];
  for (const part of parts) {
    const id = known.get(part.toLowerCase());
    if (id) matched.push(id);
    else unknown.push(part);
  }
  return { matched, unknown };
}

export function ImportExercisesDialog({ categories, onClose, onImported }: ImportExercisesDialogProps) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<ExerciseImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setRows([]);
    try {
      const text = await readCsvFile(file);
      setRows(parseExerciseCsv(text));
    } catch (err) {
      setParseError(err instanceof CsvFormatError ? err.message : 'Datei konnte nicht gelesen werden.');
    }
  }

  function handleDownloadExample() {
    downloadTextFile('uebungen-import-beispiel.csv', buildExampleCsv(categories));
  }

  const resolvedRows = rows.map((row) => {
    const focus = resolveFocusAreas(row.rawFocusAreas);
    const category = resolveCategories(row.rawCategories, categories);
    return { row, focus, category };
  });
  const validCount = resolvedRows.filter((r) => r.row.valid).length;

  async function handleImport() {
    setImporting(true);
    setImportError(null);
    try {
      await importExercises(
        resolvedRows
          .filter((r) => r.row.valid)
          .map((r) => ({
            title: r.row.title,
            learning_content: r.row.learningContent || null,
            description: r.row.description || null,
            variants: r.row.variants || null,
            focus_areas: r.focus.matched,
            age_category_ids: r.category.matched,
          })),
        profile?.id ?? null,
      );
      onImported();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import fehlgeschlagen.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      title="Übungen aus CSV importieren"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="button" disabled={importing || validCount === 0} onClick={() => void handleImport()}>
            {importing ? 'Importiere…' : `${validCount} Übungen importieren`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          CSV-Datei mit der Spalte <strong>Titel</strong> (Pflicht) sowie optional <strong>Lerninhalte</strong>,{' '}
          <strong>Beschreibung</strong>, <strong>Varianten</strong>, <strong>Fokus-Bereiche</strong> und{' '}
          <strong>Alterskategorien</strong> in der ersten Zeile. Mehrere Fokus-Bereiche bzw. Alterskategorien pro
          Übung mit Komma trennen (z.B. „Passspiel,Schuss"). Bilder/Videos sind nicht Teil des Imports und müssen pro
          Übung separat ergänzt werden. Aus Excel exportierbar über „Datei &gt; Speichern unter &gt; CSV".
        </p>

        <Button type="button" variant="secondary" onClick={handleDownloadExample} className="self-start">
          Beispieldatei herunterladen
        </Button>

        <div>
          <Label htmlFor="csvFile">CSV-Datei</Label>
          <input
            id="csvFile"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void handleFile(e)}
            className="block w-full text-sm text-text file:mr-3 file:rounded-xl file:border-0 file:bg-surface-alt file:px-3.5 file:py-2.5 file:text-sm file:font-medium file:text-text"
          />
        </div>

        {parseError && <p className="text-sm text-danger">{parseError}</p>}

        {rows.length > 0 && (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-alt text-left text-xs text-text-muted">
                <tr>
                  <th className="px-2 py-1.5">Titel</th>
                  <th className="px-2 py-1.5">Fokus-Bereiche</th>
                  <th className="px-2 py-1.5">Alterskategorien</th>
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {resolvedRows.map(({ row, focus, category }, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1.5">{row.title || '–'}</td>
                    <td className="px-2 py-1.5">{focus.matched.join(', ') || '–'}</td>
                    <td className="px-2 py-1.5">
                      {category.matched.map((id) => categories.find((c) => c.id === id)?.name ?? id).join(', ') ||
                        '–'}
                    </td>
                    <td className="px-2 py-1.5">
                      {row.valid ? (
                        <span className="text-success">OK</span>
                      ) : (
                        <span className="text-danger">{row.error}</span>
                      )}
                      {(focus.unknown.length > 0 || category.unknown.length > 0) && (
                        <span className="ml-1 text-danger">
                          Unbekannt: {[...focus.unknown, ...category.unknown].join(', ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {importError && <p className="text-sm text-danger">{importError}</p>}
      </div>
    </Modal>
  );
}
