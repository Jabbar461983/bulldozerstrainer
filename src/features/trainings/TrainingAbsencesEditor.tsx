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

interface PersonOption {
  id: string;
  lastName: string;
  label: string;
}

// Spieler und Trainer werden nach dem gleichen Muster verwaltet: alle
// Team-Mitglieder gelten standardmässig als anwesend, einzelne können hier
// als abwesend markiert werden.
function usePersonAbsences(
  personType: 'player' | 'trainer',
  options: PersonOption[],
  absences: TrainingAbsence[] | null,
  trainingId: string,
  reload: () => Promise<void>,
) {
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const personAbsences = useMemo(
    () => (absences ?? []).filter((a) => a.person_type === personType),
    [absences, personType],
  );
  const absentIds = useMemo(
    () => new Set(personAbsences.map((a) => (personType === 'player' ? a.player_id : a.trainer_id))),
    [personAbsences, personType],
  );
  const availableOptions = options.filter((o) => !absentIds.has(o.id));

  useEffect(() => {
    setSelectedId((prev) => (availableOptions.some((o) => o.id === prev) ? prev : (availableOptions[0]?.id ?? '')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, absences]);

  async function handleAdd() {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await addTrainingAbsence(trainingId, personType, selectedId);
      await reload();
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
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Abwesenheit konnte nicht entfernt werden.');
    } finally {
      setBusy(false);
    }
  }

  return { personAbsences, availableOptions, selectedId, setSelectedId, busy, error, handleAdd, handleRemove };
}

export function TrainingAbsencesEditor({ trainingId, teamId }: TrainingAbsencesEditorProps) {
  const [playerOptions, setPlayerOptions] = useState<PersonOption[]>([]);
  const [trainerOptions, setTrainerOptions] = useState<PersonOption[]>([]);
  const [absences, setAbsences] = useState<TrainingAbsence[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoadError(null);
    try {
      const [players, trainers, absenceRows] = await Promise.all([
        fetchTeamPlayerRoster(teamId),
        fetchTeamTrainerRoster(teamId),
        fetchTrainingAbsences(trainingId),
      ]);
      setPlayerOptions(
        players
          .map((p) => ({ id: p.playerId, lastName: p.lastName, label: `${p.lastName} ${p.firstName}` }))
          .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de-CH')),
      );
      setTrainerOptions(
        trainers
          .map((t) => ({ id: t.trainerId, lastName: t.lastName, label: `${t.lastName} ${t.firstName}` }))
          .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de-CH')),
      );
      setAbsences(absenceRows);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Abwesenheiten konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingId, teamId]);

  const players = usePersonAbsences('player', playerOptions, absences, trainingId, load);
  const trainers = usePersonAbsences('trainer', trainerOptions, absences, trainingId, load);

  if (playerOptions.length === 0 && trainerOptions.length === 0) {
    return <p className="text-sm text-text-muted">Diesem Team sind noch keine Spieler oder Trainer zugewiesen.</p>;
  }

  function renderGroup(
    label: string,
    group: ReturnType<typeof usePersonAbsences>,
    options: PersonOption[],
  ) {
    if (options.length === 0) return null;
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
        {group.personAbsences.length === 0 && <p className="text-sm text-text-muted">Niemand abgemeldet.</p>}
        <div className="flex flex-wrap gap-1.5">
          {group.personAbsences.map((a) => {
            const personId = a.person_type === 'player' ? a.player_id : a.trainer_id;
            const option = options.find((o) => o.id === personId);
            return (
              <span
                key={a.id}
                className="flex items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-1 text-xs text-text-muted"
              >
                {option?.label ?? 'Unbekannt'}
                <button
                  type="button"
                  disabled={group.busy}
                  onClick={() => void group.handleRemove(a.id)}
                  aria-label="Abwesenheit entfernen"
                  className="text-text-muted hover:text-danger"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>

        {group.availableOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={group.selectedId}
              onChange={(e) => group.setSelectedId(e.target.value)}
              className="min-w-0 flex-1"
            >
              {group.availableOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Button type="button" variant="secondary" disabled={group.busy} onClick={() => void group.handleAdd()}>
              Als abwesend markieren
            </Button>
          </div>
        )}

        {group.error && <p className="text-sm text-danger">{group.error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {renderGroup('Spieler', players, playerOptions)}
      {renderGroup('Trainer', trainers, trainerOptions)}
      {loadError && <p className="text-sm text-danger">{loadError}</p>}
    </div>
  );
}
