import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { FieldTypeToggle } from './FieldTypeToggle';
import { createTraining } from './api';
import { useAuth } from '../../auth/AuthContext';
import type { TrainingFieldType } from '../../types/database';

interface CreateTrainingDialogProps {
  teamId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTrainingDialog({ teamId, onClose, onCreated }: CreateTrainingDialogProps) {
  const { profile } = useAuth();
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(90);
  const [fieldType, setFieldType] = useState<TrainingFieldType>('on_field');
  const [notes, setNotes] = useState('');
  const [information, setInformation] = useState('');
  const [showExerciseDescriptions, setShowExerciseDescriptions] = useState(true);
  const [asSeries, setAsSeries] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState(9);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createTraining({
        team_id: teamId,
        date,
        start_time: startTime || null,
        duration_minutes: duration,
        field_type: fieldType,
        notes: notes || null,
        information: information || null,
        show_exercise_descriptions: showExerciseDescriptions,
        created_by: profile?.id ?? null,
        repeatWeeks: asSeries ? repeatWeeks : 0,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Training konnte nicht angelegt werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={
        <>
          <span className="min-w-0 flex-1 truncate">Neues Training anlegen</span>
          <FieldTypeToggle value={fieldType} onChange={setFieldType} />
        </>
      }
      ariaLabel="Neues Training anlegen"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="create-training-form" disabled={loading}>
            {loading ? 'Anlegen…' : 'Training anlegen'}
          </Button>
        </>
      }
    >
      <form id="create-training-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor="date">Datum*</Label>
            <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="startTime">Startzeit</Label>
            <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="duration">Dauer*</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              required
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Notizen (Trainingsstart)</Label>
          <textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <Label htmlFor="information">Informationen (Trainingsende)</Label>
          <textarea
            id="information"
            rows={3}
            value={information}
            onChange={(e) => setInformation(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            className="size-5"
            checked={showExerciseDescriptions}
            onChange={(e) => setShowExerciseDescriptions(e.target.checked)}
          />
          Übungsbeschreibung im PDF anzeigen
        </label>

        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            className="size-5"
            checked={asSeries}
            onChange={(e) => setAsSeries(e.target.checked)}
          />
          Als wöchentliche Serie anlegen
        </label>
        {asSeries && (
          <div>
            <Label htmlFor="repeatWeeks">Anzahl weiterer wöchentlicher Termine</Label>
            <Input
              id="repeatWeeks"
              type="number"
              min={1}
              max={52}
              value={repeatWeeks}
              onChange={(e) => setRepeatWeeks(Number(e.target.value))}
            />
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
