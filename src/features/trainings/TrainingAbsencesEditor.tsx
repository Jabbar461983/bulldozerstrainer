import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { fetchTeamPlayerRoster } from '../../lib/roster';
import { fetchTrainingAbsences, addTrainingAbsence, removeTrainingAbsence } from './api';
import type { TrainingAbsence } from '../../types/database';

interface TrainingAbsencesEditorProps {
  trainingId: string;
  teamId: string;
}

interface PlayerOption {
  playerId: string;
  lastName: string;
  label: string;
}

export function TrainingAbsencesEditor({ trainingId, teamId }: TrainingAbsencesEditorProps) {
  const [options, setOptions] = useState<PlayerOption[]>([]);
  const [absences, setAbsences] = useState<TrainingAbsence[] | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [players, absenceRows] = await Promise.all([
        fetchTeamPlayerRoster(teamId),
        fetchTrainingAbsences(trainingId),
      ]);
      const combined: PlayerOption[] = players
        .map((p) => ({ playerId: p.playerId, lastName: p.lastName, label: `${p.lastName} ${p.firstName}` }))
        .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de-CH'));
      setOptions(combined);
      setAbsences(absenceRows);
      const absentPlayerIdsNow = new Set(
        absenceRows.filter((a) => a.person_type === 'player').map((a) => a.player_id),
      );
      const stillAvailable = combined.filter((o) => !absentPlayerIdsNow.has(o.playerId));
      setSelectedPlayerId((prev) =>
        stillAvailable.some((o) => o.playerId === prev) ? prev : (stillAvailable[0]?.playerId ?? ''),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Abwesenheiten konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingId, teamId]);

  const playerAbsences = useMemo(() => (absences ?? []).filter((a) => a.person_type === 'player'), [absences]);
  const absentPlayerIds = useMemo(() => new Set(playerAbsences.map((a) => a.player_id)), [playerAbsences]);
  const availableOptions = options.filter((o) => !absentPlayerIds.has(o.playerId));

  async function handleAdd() {
    if (!selectedPlayerId) return;
    setBusy(true);
    setError(null);
    try {
      await addTrainingAbsence(trainingId, 'player', selectedPlayerId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Abwesenheit konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await removeTrainingAbsence(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Abwesenheit konnte nicht entfernt werden.');
    } finally {
      setBusy(false);
    }
  }

  if (options.length === 0) {
    return <p className="text-sm text-text-muted">Diesem Team sind noch keine Spieler zugewiesen.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {playerAbsences.length === 0 && <p className="text-sm text-text-muted">Niemand abgemeldet.</p>}
      <div className="flex flex-wrap gap-1.5">
        {playerAbsences.map((a) => {
          const option = options.find((o) => o.playerId === a.player_id);
          return (
            <span
              key={a.id}
              className="flex items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-1 text-xs text-text-muted"
            >
              {option?.label ?? 'Unbekannt'}
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRemove(a.id)}
                aria-label="Abwesenheit entfernen"
                className="text-text-muted hover:text-danger"
              >
                ✕
              </button>
            </span>
          );
        })}
      </div>

      {availableOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            className="min-w-0 flex-1"
          >
            {availableOptions.map((o) => (
              <option key={o.playerId} value={o.playerId}>
                {o.label}
              </option>
            ))}
          </Select>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleAdd()}>
            Als abwesend markieren
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
