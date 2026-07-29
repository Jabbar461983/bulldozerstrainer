import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { TrainingTimeline } from './TrainingTimeline';
import { AddTrainingExerciseDialog } from './AddTrainingExerciseDialog';
import {
  fetchTrainingExercises,
  addTrainingExercise,
  updateTrainingExercise,
  removeTrainingExercise,
  reorderTrainingExercises,
} from './api';
import type { TrainingExerciseRow } from './api';
import type { TrainingFieldType } from '../../types/database';

const DEFAULT_EXERCISE_DURATION = 10;

interface TrainingExercisesEditorProps {
  trainingId: string;
  totalMinutes: number;
  fieldType: TrainingFieldType;
  categoryId: string;
}

export function TrainingExercisesEditor({
  trainingId,
  totalMinutes,
  fieldType,
  categoryId,
}: TrainingExercisesEditorProps) {
  const [rows, setRows] = useState<TrainingExerciseRow[] | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const exerciseRows = await fetchTrainingExercises(trainingId);
      setRows(exerciseRows);
      setNotesDraft(Object.fromEntries(exerciseRows.map((r) => [r.id, r.notes ?? ''])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übungen konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingId]);

  async function handleAdd(exerciseId: string) {
    await addTrainingExercise(trainingId, exerciseId, DEFAULT_EXERCISE_DURATION);
    await load();
    setShowAddDialog(false);
  }

  async function handleDurationChange(id: string, duration: number) {
    setBusy(true);
    setError(null);
    try {
      await updateTrainingExercise(id, { duration_minutes: duration });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dauer konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }

  async function handleNotesBlur(id: string) {
    const notes = notesDraft[id] ?? '';
    setBusy(true);
    setError(null);
    try {
      await updateTrainingExercise(id, { notes: notes || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notiz konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await removeTrainingExercise(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übung konnte nicht entfernt werden.');
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    if (!rows) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    const reordered = [...rows];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setBusy(true);
    setError(null);
    try {
      await reorderTrainingExercises(reordered.map((r, i) => ({ id: r.id, sort_order: i })));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reihenfolge konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="secondary" onClick={() => setShowAddDialog(true)} className="self-start">
        + Übung hinzufügen
      </Button>

      <TrainingTimeline
        totalMinutes={totalMinutes}
        items={(rows ?? []).map((r) => ({ id: r.id, title: r.exerciseTitle, durationMinutes: r.duration_minutes }))}
      />

      {rows === null && <p className="text-sm text-text-muted">Lädt…</p>}

      <div className="flex flex-col gap-2">
        {rows?.map((row, i) => (
          <div key={row.id} className="flex flex-col gap-2 rounded-xl border border-border p-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || i === 0}
                  onClick={() => void handleMove(i, -1)}
                  aria-label="Nach oben verschieben"
                  className="min-h-0 px-1.5 py-0.5"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || i === rows.length - 1}
                  onClick={() => void handleMove(i, 1)}
                  aria-label="Nach unten verschieben"
                  className="min-h-0 px-1.5 py-0.5"
                >
                  ↓
                </Button>
              </div>
              <span className="flex-1 font-medium text-text">{row.exerciseTitle}</span>
              <Input
                type="number"
                min={1}
                value={row.duration_minutes}
                disabled={busy}
                onChange={(e) => void handleDurationChange(row.id, Number(e.target.value))}
                className="w-20"
              />
              <span className="text-xs text-text-muted">Min.</span>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => void handleRemove(row.id)}
                aria-label="Übung entfernen"
              >
                ✕
              </Button>
            </div>

            {row.exerciseDescription && (
              <p className="pl-9 text-xs text-text-muted">{row.exerciseDescription}</p>
            )}

            {row.media.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-9">
                {row.media.map((m) =>
                  m.type === 'image' ? (
                    <img
                      key={m.path}
                      src={m.url ?? ''}
                      alt=""
                      className="size-16 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <video key={m.path} src={m.url ?? ''} controls className="h-16 w-24 rounded-lg border border-border" />
                  ),
                )}
              </div>
            )}

            <textarea
              rows={2}
              placeholder="Notizen zu dieser Übung…"
              value={notesDraft[row.id] ?? ''}
              onChange={(e) => setNotesDraft((prev) => ({ ...prev, [row.id]: e.target.value }))}
              onBlur={() => void handleNotesBlur(row.id)}
              className="ml-9 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {showAddDialog && (
        <AddTrainingExerciseDialog
          fieldType={fieldType}
          categoryId={categoryId}
          onClose={() => setShowAddDialog(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}
