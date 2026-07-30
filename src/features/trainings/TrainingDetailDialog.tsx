import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { TrainingExercisesEditor } from './TrainingExercisesEditor';
import { TrainingRatingSection } from './TrainingRatingSection';
import { TrainingAbsencesEditor } from './TrainingAbsencesEditor';
import { TrainingTrainersEditor } from './TrainingTrainersEditor';
import { FieldTypeToggle } from './FieldTypeToggle';
import { updateTraining, deleteTraining, fetchTrainingExercises, fetchTrainingTrainers, replaceTrainingTrainers } from './api';
import { fetchTeamTrainerRoster } from '../../lib/roster';
import type { RosterTrainer } from '../../lib/roster';
import { exportTrainingPdf } from './trainingPdf';
import { TrainingSeasonSummary } from '../seasonplanning/TrainingSeasonSummary';
import type { Training, TrainingFieldType } from '../../types/database';

interface TrainingDetailDialogProps {
  training: Training;
  teamLabel: string;
  categoryId: string;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export function TrainingDetailDialog({
  training,
  teamLabel,
  categoryId,
  onClose,
  onSaved,
  onDeleted,
}: TrainingDetailDialogProps) {
  const [date, setDate] = useState(training.date);
  const [startTime, setStartTime] = useState(training.start_time ?? '');
  const [duration, setDuration] = useState(training.duration_minutes);
  const [fieldType, setFieldType] = useState<TrainingFieldType>(training.field_type);
  const [notes, setNotes] = useState(training.notes ?? '');
  const [information, setInformation] = useState(training.information ?? '');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trainerRoster, setTrainerRoster] = useState<RosterTrainer[]>([]);
  const [selectedTrainerIds, setSelectedTrainerIds] = useState<string[]>([]);
  const [trainersLoading, setTrainersLoading] = useState(true);
  const [trainersError, setTrainersError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTrainers() {
      setTrainersError(null);
      try {
        const [roster, links] = await Promise.all([
          fetchTeamTrainerRoster(training.team_id),
          fetchTrainingTrainers(training.id),
        ]);
        setTrainerRoster(roster);
        setSelectedTrainerIds(links.map((l) => l.trainer_id));
      } catch (err) {
        setTrainersError(err instanceof Error ? err.message : 'Trainer konnten nicht geladen werden.');
      } finally {
        setTrainersLoading(false);
      }
    }
    void loadTrainers();
  }, [training.id, training.team_id]);

  function toggleTrainer(trainerId: string) {
    setSelectedTrainerIds((prev) => (prev.includes(trainerId) ? prev.filter((id) => id !== trainerId) : [...prev, trainerId]));
  }

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
        field_type: fieldType,
        notes: notes || null,
        information: information || null,
      });
      if (!trainersLoading) {
        await replaceTrainingTrainers(training.id, selectedTrainerIds);
      }
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
      title={
        <>
          <span className="min-w-0 flex-1 truncate">
            Training am {new Date(`${training.date}T00:00:00`).toLocaleDateString('de-CH')}
          </span>
          <FieldTypeToggle value={fieldType} onChange={setFieldType} />
        </>
      }
      ariaLabel={`Training am ${new Date(`${training.date}T00:00:00`).toLocaleDateString('de-CH')}`}
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
          <TrainingSeasonSummary teamId={training.team_id} trainingId={training.id} trainingDate={date} />
          <div>
            <Label htmlFor="notes">Notizen</Label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <Label htmlFor="information">Informationen</Label>
            <textarea
              id="information"
              rows={3}
              value={information}
              onChange={(e) => setInformation(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>

        <div className="border-t border-border pt-4">
          <Label>Trainer</Label>
          <TrainingTrainersEditor
            trainers={trainerRoster}
            selectedIds={selectedTrainerIds}
            onToggle={toggleTrainer}
            loading={trainersLoading}
            error={trainersError}
          />
        </div>

        <div className="border-t border-border pt-4">
          <Label>Übungen</Label>
          <TrainingExercisesEditor
            trainingId={training.id}
            fieldType={fieldType}
            categoryId={categoryId}
          />
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
