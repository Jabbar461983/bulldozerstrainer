import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { TrainingExercisesEditor } from './TrainingExercisesEditor';
import { TrainingRatingSection } from './TrainingRatingSection';
import { TrainingAbsencesEditor } from './TrainingAbsencesEditor';
import { FieldTypeToggle } from './FieldTypeToggle';
import { updateTraining, deleteTraining, fetchTrainingExercises, fetchTrainingAbsences } from './api';
import { fetchTeamPlayerRoster } from '../../lib/roster';
import { exportTrainingPdf } from './trainingPdf';
import { TrainingSeasonSummary } from '../seasonplanning/TrainingSeasonSummary';
import { fetchApplicableSeasonPlanningEvents, computeTrainingSeasonCoverage } from '../seasonplanning/api';
import { SEASON_CATEGORY_ORDER } from '../seasonplanning/categories';
import type { Training, TrainingFieldType } from '../../types/database';

interface SaveSummary {
  coverage: number | null;
  plannedMinutes: number;
}

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
  const [showExerciseDescriptions, setShowExerciseDescriptions] = useState(training.show_exercise_descriptions);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSummary, setSaveSummary] = useState<SaveSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  async function handleExportPdf() {
    setExportingPdf(true);
    setError(null);
    try {
      const [exercises, absences, players, seasonEvents] = await Promise.all([
        fetchTrainingExercises(training.id),
        fetchTrainingAbsences(training.id),
        fetchTeamPlayerRoster(training.team_id),
        fetchApplicableSeasonPlanningEvents(training.team_id, date),
      ]);
      const nameByPlayerId = new Map(players.map((p) => [p.playerId, `${p.firstName} ${p.lastName}`]));
      const absentPlayerNames = absences
        .filter((a) => a.person_type === 'player' && a.player_id)
        .map((a) => nameByPlayerId.get(a.player_id as string) ?? 'Unbekannt');
      const seasonFocuses = SEASON_CATEGORY_ORDER.flatMap((category) => {
        const titles = seasonEvents
          .filter((e) => e.category === category)
          .map((e) => e.title || e.subcategory)
          .filter((t): t is string => !!t);
        return titles.length > 0 ? [{ category, content: titles.join(', ') }] : [];
      });

      await exportTrainingPdf(
        {
          ...training,
          date,
          start_time: startTime || null,
          duration_minutes: duration,
          notes: notes || null,
          information: information || null,
        },
        teamLabel,
        exercises,
        { absentPlayerNames, seasonFocuses, showExerciseDescriptions },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF konnte nicht erstellt werden.');
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSummaryLoading(true);
    try {
      const [exercises, seasonEvents] = await Promise.all([
        fetchTrainingExercises(training.id),
        fetchApplicableSeasonPlanningEvents(training.team_id, date),
      ]);
      const plannedMinutes = exercises.reduce((sum, ex) => sum + ex.duration_minutes, 0);
      const coverage = await computeTrainingSeasonCoverage(training.id, seasonEvents).catch(() => null);
      setSaveSummary({ coverage, plannedMinutes });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übersicht konnte nicht geladen werden.');
    } finally {
      setSummaryLoading(false);
    }
  }

  async function performSave() {
    setSaveSummary(null);
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
        show_exercise_descriptions: showExerciseDescriptions,
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
          <Button type="submit" form="edit-training-form" disabled={loading || summaryLoading}>
            {summaryLoading ? 'Lädt…' : loading ? 'Speichern…' : 'Speichern'}
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
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>

        <div className="border-t border-border pt-4">
          <Label>Abgemeldet</Label>
          <p className="mb-2 text-xs text-text-muted">
            Alle Spieler und Trainer des Teams gelten standardmässig als angemeldet.
          </p>
          <TrainingAbsencesEditor trainingId={training.id} teamId={training.team_id} />
        </div>

        <div className="border-t border-border pt-4">
          <Label>Übungen</Label>
          <label className="mb-3 flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              className="size-5"
              checked={showExerciseDescriptions}
              onChange={(e) => setShowExerciseDescriptions(e.target.checked)}
            />
            Übungsbeschreibung im PDF anzeigen
          </label>
          <TrainingExercisesEditor
            trainingId={training.id}
            fieldType={fieldType}
            categoryId={categoryId}
          />
        </div>

        <div className="border-t border-border pt-4">
          <Label>Bewertung</Label>
          <TrainingRatingSection trainingId={training.id} />
        </div>
      </div>

      {saveSummary && (
        <Modal
          title="Training speichern"
          onClose={() => setSaveSummary(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setSaveSummary(null)}>
                Zurück
              </Button>
              <Button type="button" disabled={loading} onClick={() => void performSave()}>
                {loading ? 'Speichert…' : 'OK'}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-2 text-sm text-text">
            <p>
              {saveSummary.coverage !== null
                ? `${saveSummary.coverage}% der Trainingseinheit gemäss Saisonplanung geplant.`
                : 'Prozentzahl gemäss Saisonplanung konnte nicht berechnet werden.'}
            </p>
            <p>
              {saveSummary.plannedMinutes} von {duration} Minuten des Trainings verplant.
            </p>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
