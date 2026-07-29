import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { fetchTeamPlayerRoster, fetchTeamTrainerRoster } from '../../lib/roster';
import { fetchTrainingAbsences, addTrainingAbsence, removeTrainingAbsence } from './api';
import type { TrainingAbsence } from '../../types/database';

interface TrainingAbsencesEditorProps {
  trainingId: string;
  teamId: string;
}

interface AbsenceOption {
  key: string;
  personType: 'player' | 'trainer';
  personId: string;
  lastName: string;
  label: string;
}

export function TrainingAbsencesEditor({ trainingId, teamId }: TrainingAbsencesEditorProps) {
  const [options, setOptions] = useState<AbsenceOption[]>([]);
  const [absences, setAbsences] = useState<TrainingAbsence[] | null>(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [players, trainers, absenceRows] = await Promise.all([
        fetchTeamPlayerRoster(teamId),
        fetchTeamTrainerRoster(teamId),
        fetchTrainingAbsences(trainingId),
      ]);
      const combined: AbsenceOption[] = [
        ...players.map((p) => ({
          key: `player:${p.playerId}`,
          personType: 'player' as const,
          personId: p.playerId,
          lastName: p.lastName,
          label: `${p.lastName} ${p.firstName} (Spieler)`,
        })),
        ...trainers.map((t) => ({
          key: `trainer:${t.trainerId}`,
          personType: 'trainer' as const,
          personId: t.trainerId,
          lastName: t.lastName,
          label: `${t.lastName} ${t.firstName} (Trainer)`,
        })),
      ].sort((a, b) => a.lastName.localeCompare(b.lastName, 'de-CH'));
      setOptions(combined);
      setAbsences(absenceRows);
      const absentKeysNow = new Set(
        absenceRows.map((a) => `${a.person_type}:${a.person_type === 'player' ? a.player_id : a.trainer_id}`),
      );
      const stillAvailable = combined.filter((o) => !absentKeysNow.has(o.key));
      setSelectedKey((prev) =>
        stillAvailable.some((o) => o.key === prev) ? prev : (stillAvailable[0]?.key ?? ''),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Abwesenheiten konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingId, teamId]);

  const absentKeys = useMemo(
    () => new Set((absences ?? []).map((a) => `${a.person_type}:${a.person_type === 'player' ? a.player_id : a.trainer_id}`)),
    [absences],
  );
  const availableOptions = options.filter((o) => !absentKeys.has(o.key));

  async function handleAdd() {
    const option = options.find((o) => o.key === selectedKey);
    if (!option) return;
    setBusy(true);
    setError(null);
    try {
      await addTrainingAbsence(trainingId, option.personType, option.personId);
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
    return <p className="text-sm text-text-muted">Diesem Team sind noch keine Spieler oder Trainer zugewiesen.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {absences?.length === 0 && <p className="text-sm text-text-muted">Niemand abgemeldet.</p>}
      <div className="flex flex-wrap gap-1.5">
        {absences?.map((a) => {
          const option = options.find(
            (o) => o.personType === a.person_type && o.personId === (a.person_type === 'player' ? a.player_id : a.trainer_id),
          );
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
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="min-w-0 flex-1"
          >
            {availableOptions.map((o) => (
              <option key={o.key} value={o.key}>
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
