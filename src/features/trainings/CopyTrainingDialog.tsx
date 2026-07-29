import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { Select } from '../../components/Select';
import { createTraining, duplicateTrainingContent } from './api';
import { useAuth } from '../../auth/AuthContext';
import { todayIso } from '../../lib/dates';
import type { Training } from '../../types/database';

interface CopyTrainingDialogProps {
  teamId: string;
  trainings: Training[];
  onClose: () => void;
  onCreated: () => void;
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

export function CopyTrainingDialog({ teamId, trainings, onClose, onCreated }: CopyTrainingDialogProps) {
  const { profile } = useAuth();
  const sorted = [...trainings].sort(
    (a, b) => b.date.localeCompare(a.date) || (b.start_time ?? '').localeCompare(a.start_time ?? ''),
  );
  const [sourceId, setSourceId] = useState(sorted[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const source = sorted.find((t) => t.id === sourceId) ?? null;

  useEffect(() => {
    setStartTime(source?.start_time ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!source) return;
    setError(null);
    setLoading(true);
    try {
      const ids = await createTraining({
        team_id: teamId,
        date,
        start_time: startTime || null,
        duration_minutes: source.duration_minutes,
        field_type: source.field_type,
        notes: source.notes,
        information: source.information,
        created_by: profile?.id ?? null,
      });
      if (ids.length > 0) {
        await duplicateTrainingContent(source.id, ids[0]);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Training konnte nicht kopiert werden.');
    } finally {
      setLoading(false);
    }
  }

  if (sorted.length === 0) {
    return (
      <Modal
        title="Training kopieren"
        onClose={onClose}
        footer={
          <Button type="button" variant="secondary" onClick={onClose}>
            Schliessen
          </Button>
        }
      >
        <p className="text-sm text-text-muted">Für dieses Team gibt es noch kein Training, das kopiert werden könnte.</p>
      </Modal>
    );
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
          <Button type="submit" form="copy-training-form" disabled={loading || !date}>
            {loading ? 'Kopieren…' : 'Training kopieren'}
          </Button>
        </>
      }
    >
      <form id="copy-training-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="sourceTraining">Bestehendes Training</Label>
          <Select id="sourceTraining" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {formatTrainingLabel(t)}
              </option>
            ))}
          </Select>
        </div>

        <p className="rounded-xl bg-surface-alt p-3 text-sm text-text-muted">
          Übernimmt Dauer, Trainingsart, Notizen, Informationen, Übungen &amp; Zeitbalken sowie Trainer 1:1 vom
          gewählten Training.
          Danach lässt sich das neue Training frei anpassen.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="copyDate">Neues Datum</Label>
            <Input
              id="copyDate"
              type="date"
              required
              min={todayIso()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="copyStartTime">Startzeit (optional)</Label>
            <Input
              id="copyStartTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
