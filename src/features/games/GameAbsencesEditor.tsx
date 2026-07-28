import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { fetchTeamPlayerRoster, fetchTeamTrainerRoster, fetchGameAbsences, replaceGameAbsences } from './api';
import type { RosterPlayer, RosterTrainer } from './api';

interface GameAbsencesEditorProps {
  gameId: string;
  teamId: string;
}

export function GameAbsencesEditor({ gameId, teamId }: GameAbsencesEditorProps) {
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [trainers, setTrainers] = useState<RosterTrainer[]>([]);
  const [absentPlayerIds, setAbsentPlayerIds] = useState<string[]>([]);
  const [absentTrainerIds, setAbsentTrainerIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [playerRows, trainerRows, absences] = await Promise.all([
        fetchTeamPlayerRoster(teamId),
        fetchTeamTrainerRoster(teamId),
        fetchGameAbsences(gameId),
      ]);
      setPlayers(playerRows);
      setTrainers(trainerRows);
      setAbsentPlayerIds(absences.filter((a) => a.person_type === 'player').map((a) => a.player_id as string));
      setAbsentTrainerIds(absences.filter((a) => a.person_type === 'trainer').map((a) => a.trainer_id as string));
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Abwesenheiten konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, teamId]);

  function togglePlayer(id: string) {
    setAbsentPlayerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleTrainer(id: string) {
    setAbsentTrainerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await replaceGameAbsences(gameId, absentPlayerIds, absentTrainerIds);
      setNotice('Abwesenheiten gespeichert.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Abwesenheiten konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p className="text-sm text-text-muted">Lädt…</p>;
  if (players.length === 0 && trainers.length === 0) {
    return <p className="text-sm text-text-muted">Diesem Team sind noch keine Spieler oder Trainer zugewiesen.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {players.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-text-muted">Spieler</p>
          <div className="flex flex-wrap gap-1.5">
            {players.map((p) => (
              <label
                key={p.playerId}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-text"
              >
                <input
                  type="checkbox"
                  checked={absentPlayerIds.includes(p.playerId)}
                  onChange={() => togglePlayer(p.playerId)}
                />
                {p.firstName} {p.lastName}
              </label>
            ))}
          </div>
        </div>
      )}

      {trainers.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-text-muted">Trainer</p>
          <div className="flex flex-wrap gap-1.5">
            {trainers.map((t) => (
              <label
                key={t.trainerId}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-text"
              >
                <input
                  type="checkbox"
                  checked={absentTrainerIds.includes(t.trainerId)}
                  onChange={() => toggleTrainer(t.trainerId)}
                />
                {t.firstName} {t.lastName}
              </label>
            ))}
          </div>
        </div>
      )}

      <Button type="button" disabled={saving} onClick={() => void handleSave()} className="self-start">
        {saving ? 'Speichern…' : 'Abwesenheiten speichern'}
      </Button>
      {notice && <p className="text-sm text-success">{notice}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
