import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Label } from '../../components/Input';
import { Select } from '../../components/Select';
import { parseRosterCsv, CsvFormatError, toCsv } from '../../lib/csv';
import type { RosterImportRow } from '../../lib/csv';
import { downloadTextFile } from '../../lib/downloadFile';
import { importPlayers } from './api';
import { resolveTeamOption } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';

interface ImportPlayersDialogProps {
  teamOptions: TeamOption[];
  onClose: () => void;
  onImported: () => void;
}

function buildExampleCsv(teamOptions: TeamOption[]): string {
  const sample1 = teamOptions[0];
  const sample2 = teamOptions[1] ?? teamOptions[0];
  const header = ['Vorname', 'Nachname', 'Geburtsdatum', 'Kategorie', 'Team'];
  const row1 = ['Max', 'Muster', '12.05.2012', sample1?.categoryName ?? 'U15', sample1?.teamName ?? 'U15'];
  const row2 = ['Anna', 'Beispiel', '30.08.2011', sample2?.categoryName ?? 'U15', sample2?.teamName ?? 'U15'];
  return toCsv([header, row1, row2]);
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

  function handleDownloadExample() {
    downloadTextFile('spieler-import-beispiel.csv', buildExampleCsv(teamOptions));
  }

  const resolvedRows = rows.map((row) => {
    const matched = resolveTeamOption(teamOptions, row.rawCategory, row.rawTeam);
    return { row, team: matched ?? teamOptions.find((t) => t.teamId === teamId) };
  });
  const validCount = resolvedRows.filter((r) => r.row.valid && r.team).length;

  async function handleImport() {
    if (!teamId) return;
    setImporting(true);
    setImportError(null);
    try {
      await importPlayers(
        resolvedRows
          .filter((r) => r.row.valid && r.team)
          .map((r) => ({ row: r.row, teamId: r.team!.teamId })),
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
          CSV-Datei mit den Spalten <strong>Vorname</strong>, <strong>Nachname</strong>, optional{' '}
          <strong>Geburtsdatum</strong> (TT.MM.JJJJ oder JJJJ-MM-TT) sowie optional <strong>Kategorie</strong> und{' '}
          <strong>Team</strong> (jeweils der genaue Name, z.B. Kategorie „U15", Team „A") in der ersten Zeile. Fehlen Kategorie/Team bei
          einer Zeile oder passen sie zu keinem bestehenden Team, wird das unten gewählte Ziel-Team verwendet.
          Aus Excel exportierbar über „Datei &gt; Speichern unter &gt; CSV".
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
          <div>
            <Label htmlFor="targetTeam">Standard-Ziel-Team (falls in der Datei keine Kategorie/Team angegeben ist)</Label>
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
                  <th className="px-2 py-1.5">Team</th>
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {resolvedRows.map(({ row, team }, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1.5">{row.firstName}</td>
                    <td className="px-2 py-1.5">{row.lastName}</td>
                    <td className="px-2 py-1.5">{row.rawBirthdate}</td>
                    <td className="px-2 py-1.5">
                      {team ? `${team.categoryName} · ${team.teamName}` : '–'}
                    </td>
                    <td className="px-2 py-1.5">
                      {row.valid && team ? (
                        <span className="text-success">OK</span>
                      ) : (
                        <span className="text-danger">{row.error ?? 'Kein Ziel-Team'}</span>
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
