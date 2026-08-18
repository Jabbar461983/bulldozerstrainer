import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Label } from '../../components/Input';
import { parseFixtureCsv, readCsvFile, CsvFormatError, toCsv } from '../../lib/csv';
import type { FixtureImportRow } from '../../lib/csv';
import { downloadTextFile } from '../../lib/downloadFile';
import { importGames } from './api';

function buildExampleCsv(): string {
  const header = ['Datum', 'Zeit', 'Ort', 'Heim', 'Gast', 'Saison'];
  const row1 = ['15.08.2026', '19:30', 'Halle Kernenried', 'Bulldozers Kernenried-Zauggenried', 'HC Beispiel', '2026/2027'];
  const row2 = ['22.08.2026', '18:00', 'Auswärts', 'HC Muster', 'Bulldozers Kernenried-Zauggenried', '2026/2027'];
  return toCsv([header, row1, row2]);
}

interface ImportGamesDialogProps {
  teamId: string;
  categoryId: string;
  onClose: () => void;
  onImported: () => void;
}

export function ImportGamesDialog({ teamId, categoryId, onClose, onImported }: ImportGamesDialogProps) {
  const [rows, setRows] = useState<FixtureImportRow[]>([]);
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
      setRows(parseFixtureCsv(text));
    } catch (err) {
      setParseError(err instanceof CsvFormatError ? err.message : 'Datei konnte nicht gelesen werden.');
    }
  }

  const validCount = rows.filter((r) => r.valid).length;

  function handleDownloadExample() {
    downloadTextFile('spielplan-import-beispiel.csv', buildExampleCsv());
  }

  async function handleImport() {
    setImporting(true);
    setImportError(null);
    try {
      await importGames(rows, teamId, categoryId);
      onImported();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import fehlgeschlagen.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      title="Spielplan aus CSV importieren"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="button" disabled={importing || validCount === 0} onClick={() => void handleImport()}>
            {importing ? 'Importiere…' : `${validCount} Spiele importieren`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          CSV-Datei mit den Spalten <strong>Datum</strong>, <strong>Heim</strong>, <strong>Gast</strong> sowie
          optional <strong>Zeit</strong> (HH:MM), <strong>Ort</strong> und <strong>Saison</strong> in der ersten
          Zeile. Aus Excel exportierbar über „Datei &gt; Speichern unter &gt; CSV“.
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
                  <th className="px-2 py-1.5">Datum</th>
                  <th className="px-2 py-1.5">Zeit</th>
                  <th className="px-2 py-1.5">Heim</th>
                  <th className="px-2 py-1.5">Gast</th>
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1.5">{row.rawDate}</td>
                    <td className="px-2 py-1.5">{row.time ?? '–'}</td>
                    <td className="px-2 py-1.5">{row.homeTeam}</td>
                    <td className="px-2 py-1.5">{row.awayTeam}</td>
                    <td className="px-2 py-1.5">
                      {row.valid ? <span className="text-success">OK</span> : <span className="text-danger">{row.error}</span>}
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
