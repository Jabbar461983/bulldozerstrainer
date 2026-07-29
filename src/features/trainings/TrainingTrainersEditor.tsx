import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { fetchTeamTrainerRoster } from '../../lib/roster';
import type { RosterTrainer } from '../../lib/roster';
import { fetchTrainingTrainers, replaceTrainingTrainers } from './api';

interface TrainingTrainersEditorProps {
  trainingId: string;
  teamId: string;
}

export function TrainingTrainersEditor({ trainingId, teamId }: TrainingTrainersEditorProps) {
  const [trainers, setTrainers] = useState<RosterTrainer[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [roster, links] = await Promise.all([fetchTeamTrainerRoster(teamId), fetchTrainingTrainers(trainingId)]);
      setTrainers(roster);
      setSelectedIds(links.map((l) => l.trainer_id));
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trainer konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingId, teamId]);

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await replaceTrainingTrainers(trainingId, selectedIds);
      setNotice('Trainer gespeichert.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trainer konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return error ? (
      <p className="text-sm text-danger">{error}</p>
    ) : (
      <p className="text-sm text-text-muted">Lädt…</p>
    );
  }
  if (trainers.length === 0) {
    return <p className="text-sm text-text-muted">Diesem Team sind noch keine Trainer zugewiesen.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {trainers.map((t) => (
          <label
            key={t.trainerId}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-text"
          >
            <input type="checkbox" checked={selectedIds.includes(t.trainerId)} onChange={() => toggle(t.trainerId)} />
            {t.firstName} {t.lastName}
          </label>
        ))}
      </div>
      <Button type="button" disabled={saving} onClick={() => void handleSave()} className="self-start">
        {saving ? 'Speichern…' : 'Trainer speichern'}
      </Button>
      {notice && <p className="text-sm text-success">{notice}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
