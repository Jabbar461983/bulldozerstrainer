import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { TrainingExercisesEditor } from './TrainingExercisesEditor';
import { TrainingRatingSection } from './TrainingRatingSection';
import { TrainingAbsencesEditor } from './TrainingAbsencesEditor';
import { updateTraining, deleteTraining, fetchTrainingExercises } from './api';
import { exportTrainingPdf } from './trainingPdf';
import type { Training } from '../../types/database';

interface TrainingDetailDialogProps {
  training: Training;
  teamLabel: string;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export function TrainingDetailDialog({ training, teamLabel, onClose, onSaved, onDeleted }: TrainingDetailDialogProps) {
  const [date, setDate] = useState(training.date);
  const [startTime, setStartTime] = useState(training.start_time ?? '');
  const [duration, setDuration] = useState(training.duration_minutes);
  const [notes, setNotes] = useState(training.notes ?? '');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExportPdf() {
    setExportingPdf(true);
    setError(null);
    try {
      const exercises = await fetchTrainingExercises(training.id);
      await exportTrainingPdf({ ...training, date, start_time: startTime || null, duration_minutes: duration, notes: notes || null }, teamLabel, exercises);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF konnte nicht erstellt werden.');
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateTraining(training.id, {
        date,
        start_time: startTime || null,
        duration_minutes: duration,
        notes: notes || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Änderungen konnten nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm('Dieses Training wirklich unwiderruflich löschen?');
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteTraining(training.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Training konnte nicht gelöscht werden.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      title={`Training am ${new Date(`${training.date}T00:00:00`).toLocaleDateString('de-CH')}`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="danger" disabled={deleting} onClick={() => void handleDelete()}>
            Löschen
          </Button>
          <Button type="button" variant="secondary" disabled={exportingPdf} onClick={() => void handleExportPdf()}>
            {exportingPdf ? 'Erstelle PDF…' : 'Als PDF'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Schliessen
          </Button>
          <Button type="submit" form="edit-training-form" disabled={loading}>
            {loading ? 'Speichern…' : 'Speichern'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <form id="edit-training-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date">Datum</Label>
              <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="startTime">Startzeit (optional)</Label>
              <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="duration">Trainingsdauer (Minuten)</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              required
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="notes">Notizen (optional)</Label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>

        <div className="border-t border-border pt-4">
          <Label>Übungen &amp; Zeitbalken</Label>
          <TrainingExercisesEditor trainingId={training.id} totalMinutes={duration} />
        </div>

        <div className="border-t border-border pt-4">
          <Label>Abgemeldet</Label>
          <TrainingAbsencesEditor trainingId={training.id} teamId={training.team_id} />
        </div>

        <div className="border-t border-border pt-4">
          <Label>Bewertung</Label>
          <TrainingRatingSection trainingId={training.id} />
        </div>
      </div>
    </Modal>
  );
}
