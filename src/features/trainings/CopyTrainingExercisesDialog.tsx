import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Label } from '../../components/Input';
import { Select } from '../../components/Select';
import { replaceTrainingExercises, fetchTrainingExercises } from './api';
import type { Training, TrainingExercise } from '../../types/database';

interface CopyTrainingExercisesDialogProps {
  sourceTrainings: Training[];
  targetTrainingId: string;
  onClose: () => void;
  onDone: () => void;
}

function formatTrainingLabel(t: Training): string {
  const dateLabel = new Date(`${t.date}T00:00:00`).toLocaleDateString('de-CH', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeLabel = t.start_time ? ` · ${t.start_time.slice(0, 5)}` : '';
  const typeLabel = t.field_type === 'off_field' ? 'Off Field' : 'On Field';
  return `${dateLabel}${timeLabel} (${t.duration_minutes} Min., ${typeLabel})`;
}

export function CopyTrainingExercisesDialog({
  sourceTrainings,
  targetTrainingId,
  onClose,
  onDone,
}: CopyTrainingExercisesDialogProps) {
  const sorted = [...sourceTrainings].sort(
    (a, b) => b.date.localeCompare(a.date) || (b.start_time ?? '').localeCompare(a.start_time ?? ''),
  );
  const [selectedId, setSelectedId] = useState(sorted[0]?.id ?? '');
  const [exercises, setExercises] = useState<TrainingExercise[]>([]);
  const [exerciseDetails, setExerciseDetails] = useState<Map<string, { title: string; description: string | null }>>(
    new Map(),
  );
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadExercises() {
      if (!selectedId) return;
      setLoading(true);
      setError(null);
      try {
        const exercises = await fetchTrainingExercises(selectedId);
        setExercises(exercises);
        const details = new Map(exercises.map((e) => [e.exercise_id, { title: (e as any).exerciseTitle, description: (e as any).exerciseDescription }]));
        setExerciseDetails(details);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Übungen konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    }
    void loadExercises();
  }, [selectedId]);

  async function handleCopy() {
    if (!selectedId) return;
    setCopying(true);
    setError(null);
    try {
      await replaceTrainingExercises(selectedId, targetTrainingId);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übungen konnten nicht kopiert werden.');
    } finally {
      setCopying(false);
    }
  }

  return (
    <Modal
      title="Training kopieren"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="button" disabled={copying || !selectedId} onClick={() => void handleCopy()}>
            {copying ? 'Kopiert…' : 'Training kopieren'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="sourceTraining">Bestehendes Training</Label>
          <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} id="sourceTraining">
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {formatTrainingLabel(t)}
              </option>
            ))}
          </Select>
        </div>

        <p className="rounded-xl bg-surface-alt p-3 text-sm text-text-muted">
          Die Übungen und Notizen zu den Übungen vom gewählten Training werden übernommen. Alle bisherigen Übungen
          werden ersetzt.
        </p>

        {error && <p className="text-sm text-danger">{error}</p>}

        {loading ? (
          <p className="text-sm text-text-muted">Lädt…</p>
        ) : exercises.length === 0 ? (
          <p className="text-sm text-text-muted">Dieses Training hat keine Übungen.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-text">Übungen ({exercises.length}):</p>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-surface p-3">
              {exercises.map((e: TrainingExercise) => {
                const detail = exerciseDetails.get(e.exercise_id);
                return (
                  <div key={e.id} className="text-sm text-text">
                    <p className="font-medium">{detail?.title || 'Unbekannte Übung'}</p>
                    {e.notes && <p className="text-xs text-text-muted">Notiz: {e.notes}</p>}
                    <p className="text-xs text-text-muted">{e.duration_minutes} Min.</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
