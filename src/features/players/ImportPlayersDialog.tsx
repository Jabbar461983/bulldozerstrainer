import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Label } from '../../components/Input';
import { Select } from '../../components/Select';
import { parseRosterCsv, CsvFormatError } from '../../lib/csv';
import type { RosterImportRow } from '../../lib/csv';
import { importPlayers } from './api';
import type { TeamOption } from '../../lib/teams';

interface ImportPlayersDialogProps {
  teamOptions: TeamOption[];
  onClose: () => void;
  onImported: () => void;
}

export function ImportPlayersDialog({ teamOptions, onClose, onImported }: ImportPlayersDialogProps) {
  const [rows, setRows] = useState<RosterImportRow[]>([]);
  const [teamId, setTeamId] = useState(teamOptions[0]?.teamId ?? '');
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setRows([]);
    try {
      const text = await file.text();
      setRows(parseRosterCsv(text));
    } catch (err) {
      setParseError(err instanceof CsvFormatError ? err.message : 'Datei konnte nicht gelesen werden.');
    }
  }

  const validCount = rows.filter((r) => r.valid).length;

  async function handleImport() {
    if (!teamId) return;
    setImporting(true);
    setImportError(null);
    try {
      await importPlayers(rows, teamId);
      onImported();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import fehlgeschlagen.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      title="Spieler aus CSV importieren"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={importing || validCount === 0 || !teamId}
            onClick={() => void handleImport()}
          >
            {importing ? 'Importiere…' : `${validCount} Spieler importieren`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          CSV-Datei mit den Spalten <strong>Vorname</strong>, <strong>Nachname</strong> und optional{' '}
          <strong>Geburtsdatum</strong> (Format TT.MM.JJJJ oder JJJJ-MM-TT) in der ersten Zeile. Aus Excel
          exportierbar über „Datei &gt; Speichern unter &gt; CSV“.
        </p>

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
          <div>
            <Label htmlFor="targetTeam">Ziel-Team</Label>
            <Select id="targetTeam" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teamOptions.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.categoryName} · {t.teamName} ({t.season})
                </option>
              ))}
            </Select>
          </div>
        )}

        {rows.length > 0 && (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-alt text-left text-xs text-text-muted">
                <tr>
                  <th className="px-2 py-1.5">Vorname</th>
                  <th className="px-2 py-1.5">Nachname</th>
                  <th className="px-2 py-1.5">Geburtsdatum</th>
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1.5">{row.firstName}</td>
                    <td className="px-2 py-1.5">{row.lastName}</td>
                    <td className="px-2 py-1.5">{row.rawBirthdate}</td>
                    <td className="px-2 py-1.5">
                      {row.valid ? (
                        <span className="text-success">OK</span>
                      ) : (
                        <span className="text-danger">{row.error}</span>
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
