import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { AddTrainingExerciseDialog } from './AddTrainingExerciseDialog';
import { TrainingExerciseDetailDialog } from './TrainingExerciseDetailDialog';
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
  fieldType: TrainingFieldType;
  categoryId: string;
  totalDurationMinutes: number;
}

export function TrainingExercisesEditor({
  trainingId,
  fieldType,
  categoryId,
  totalDurationMinutes,
}: TrainingExercisesEditorProps) {
  const [rows, setRows] = useState<TrainingExerciseRow[] | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const rowsRef = useRef<TrainingExerciseRow[] | null>(null);
  const rowElsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

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

  // Drag & Drop per Pointer-Events statt HTML5-DnD, damit es auch auf
  // Touch-Geräten funktioniert. Während des Ziehens wird die Liste bereits
  // live umsortiert; beim Loslassen wird die Reihenfolge persistiert.
  useEffect(() => {
    if (!dragId) return;

    function onMove(e: PointerEvent) {
      const current = rowsRef.current;
      if (!current) return;
      const draggedIndex = current.findIndex((r) => r.id === dragId);
      if (draggedIndex === -1) return;
      for (let i = 0; i < current.length; i++) {
        if (i === draggedIndex) continue;
        const el = rowElsRef.current.get(current[i].id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if ((draggedIndex < i && e.clientY > midY) || (draggedIndex > i && e.clientY < midY)) {
          const next = [...current];
          const [moved] = next.splice(draggedIndex, 1);
          next.splice(i, 0, moved);
          setRows(next);
          break;
        }
      }
    }

    function onUp() {
      setDragId(null);
      const current = rowsRef.current;
      if (current) {
        void reorderTrainingExercises(current.map((r, i) => ({ id: r.id, sort_order: i }))).catch((err) => {
          setError(err instanceof Error ? err.message : 'Reihenfolge konnte nicht gespeichert werden.');
        });
      }
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragId]);

  function openAddDialog(atIndex: number) {
    setInsertIndex(atIndex);
  }

  async function handleAdd(exerciseId: string) {
    await addTrainingExercise(trainingId, exerciseId, DEFAULT_EXERCISE_DURATION);
    const fresh = await fetchTrainingExercises(trainingId);
    const targetIndex = insertIndex ?? fresh.length - 1;
    if (targetIndex < fresh.length - 1) {
      const newRow = fresh[fresh.length - 1];
      const withoutNew = fresh.filter((r) => r.id !== newRow.id);
      withoutNew.splice(targetIndex, 0, newRow);
      await reorderTrainingExercises(withoutNew.map((r, i) => ({ id: r.id, sort_order: i })));
    }
    await load();
    setInsertIndex(null);
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
      setDetailRowId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übung konnte nicht entfernt werden.');
    } finally {
      setBusy(false);
    }
  }

  const detailRow = rows?.find((r) => r.id === detailRowId) ?? null;
  const plannedMinutes = rows?.reduce((sum, r) => sum + r.duration_minutes, 0) ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => openAddDialog(rows?.length ?? 0)}
          className="shrink-0"
        >
          + Übung hinzufügen
        </Button>
        {rows && rows.length > 0 && (
          <div className="flex min-w-[140px] flex-1 items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  plannedMinutes > totalDurationMinutes ? 'bg-danger' : 'bg-success',
                )}
                style={{ width: `${Math.min(100, (plannedMinutes / Math.max(1, totalDurationMinutes)) * 100)}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-text-muted">
              {plannedMinutes} von {totalDurationMinutes} Min. verplant
            </span>
          </div>
        )}
      </div>

      {rows === null && <p className="text-sm text-text-muted">Lädt…</p>}
      {rows?.length === 0 && <p className="text-sm text-text-muted">Noch keine Übungen eingeplant.</p>}

      {rows && rows.length > 0 && (
        <div className="flex flex-col">
          {rows.map((row, i) => {
            const thumbnail = row.media.find((m) => m.type === 'image' && m.url);
            return (
              <div key={row.id}>
                <div className="flex justify-center py-0.5">
                  <button
                    type="button"
                    onClick={() => openAddDialog(i)}
                    aria-label="Übung an dieser Stelle einfügen"
                    className="flex size-5 items-center justify-center rounded-full border border-dashed border-border text-xs text-text-muted transition hover:border-accent hover:text-accent"
                  >
                    +
                  </button>
                </div>
                <div
                  ref={(el) => {
                    if (el) rowElsRef.current.set(row.id, el);
                    else rowElsRef.current.delete(row.id);
                  }}
                  className={clsx(
                    'flex items-start gap-3 rounded-xl border border-border p-2 transition',
                    dragId === row.id && 'opacity-50',
                  )}
                >
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setDragId(row.id);
                    }}
                    aria-label="Übung verschieben"
                    className="mt-1 shrink-0 touch-none px-1 py-1 text-text-muted transition hover:text-text active:cursor-grabbing"
                  >
                    ⠿
                  </button>

                  {thumbnail ? (
                    <img
                      src={thumbnail.url ?? ''}
                      alt=""
                      className="h-32 w-48 shrink-0 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="h-32 w-48 shrink-0 rounded-lg border border-dashed border-border" />
                  )}

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setDetailRowId(row.id)}
                      className="block w-full text-left text-sm font-bold text-text hover:text-accent hover:underline"
                    >
                      {row.exerciseTitle}
                    </button>
                    <div className="mt-1 flex items-center gap-1">
                      <div className="w-16 shrink-0">
                        <Input
                          type="number"
                          min={1}
                          value={row.duration_minutes}
                          disabled={busy}
                          onChange={(e) => void handleDurationChange(row.id, Number(e.target.value))}
                          className="text-center font-semibold"
                        />
                      </div>
                      <span className="shrink-0 text-[10px] text-text-muted">Min.</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <textarea
                        rows={1}
                        placeholder="Notizen zu dieser Übung…"
                        value={notesDraft[row.id] ?? ''}
                        onChange={(e) => setNotesDraft((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        onBlur={() => void handleNotesBlur(row.id)}
                        className="min-w-0 flex-1 resize-none rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRemove(row.id)}
                        aria-label="Übung aus Training entfernen"
                        className="shrink-0 text-text-muted transition hover:text-danger disabled:opacity-50"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex justify-center py-0.5">
            <button
              type="button"
              onClick={() => openAddDialog(rows.length)}
              aria-label="Übung am Ende einfügen"
              className="flex size-5 items-center justify-center rounded-full border border-dashed border-border text-xs text-text-muted transition hover:border-accent hover:text-accent"
            >
              +
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {insertIndex !== null && (
        <AddTrainingExerciseDialog
          fieldType={fieldType}
          categoryId={categoryId}
          onClose={() => setInsertIndex(null)}
          onAdd={handleAdd}
        />
      )}

      {detailRow && (
        <TrainingExerciseDetailDialog
          row={detailRow}
          busy={busy}
          onClose={() => setDetailRowId(null)}
          onDurationChange={(duration) => void handleDurationChange(detailRow.id, duration)}
          onRemove={() => void handleRemove(detailRow.id)}
        />
      )}
    </div>
  );
}
