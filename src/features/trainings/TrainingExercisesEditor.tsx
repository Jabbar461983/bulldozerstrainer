import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { Input, Label } from '../../components/Input';
import { ChipMultiPicker } from '../../components/ChipMultiPicker';
import { TrainingTimeline } from './TrainingTimeline';
import {
  fetchTrainingExercises,
  addTrainingExercise,
  updateTrainingExercise,
  removeTrainingExercise,
  reorderTrainingExercises,
} from './api';
import type { TrainingExerciseRow } from './api';
import { fetchExerciseOptions, ON_FIELD_FOCUS_OPTIONS, OFF_FIELD_FOCUS_OPTIONS } from '../exercises/api';
import type { ExerciseOption } from '../exercises/api';
import type { ExerciseFocus, TrainingFieldType } from '../../types/database';

interface TrainingExercisesEditorProps {
  trainingId: string;
  totalMinutes: number;
  fieldType: TrainingFieldType;
}

export function TrainingExercisesEditor({ trainingId, totalMinutes, fieldType }: TrainingExercisesEditorProps) {
  const [rows, setRows] = useState<TrainingExerciseRow[] | null>(null);
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [focusFilter, setFocusFilter] = useState<string[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [newDuration, setNewDuration] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [exerciseRows, options] = await Promise.all([fetchTrainingExercises(trainingId), fetchExerciseOptions()]);
      setRows(exerciseRows);
      setExerciseOptions(options);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übungen konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingId]);

  useEffect(() => {
    setFocusFilter([]);
  }, [fieldType]);

  const availableOptions = useMemo(() => {
    const withinFieldType = exerciseOptions.filter((o) => {
      if (fieldType === 'off_field') return o.focus_areas.some((f) => OFF_FIELD_FOCUS_OPTIONS.includes(f));
      return true;
    });
    if (focusFilter.length === 0) return withinFieldType;
    return withinFieldType.filter((o) => focusFilter.some((f) => o.focus_areas.includes(f as ExerciseFocus)));
  }, [exerciseOptions, fieldType, focusFilter]);

  useEffect(() => {
    if (availableOptions.length === 0) {
      setSelectedExerciseId('');
      return;
    }
    if (!availableOptions.some((o) => o.id === selectedExerciseId)) {
      setSelectedExerciseId(availableOptions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableOptions]);

  async function handleAdd() {
    if (!selectedExerciseId) return;
    setBusy(true);
    setError(null);
    try {
      await addTrainingExercise(trainingId, selectedExerciseId, newDuration);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übung konnte nicht hinzugefügt werden.');
    } finally {
      setBusy(false);
    }
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
      <TrainingTimeline
        totalMinutes={totalMinutes}
        items={(rows ?? []).map((r) => ({ id: r.id, title: r.exerciseTitle, durationMinutes: r.duration_minutes }))}
      />

      {rows === null && <p className="text-sm text-text-muted">Lädt…</p>}

      <div className="flex flex-col gap-2">
        {rows?.map((row, i) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2 text-sm"
          >
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
        ))}
      </div>

      {exerciseOptions.length === 0 ? (
        <p className="text-sm text-text-muted">
          Noch keine Übungen in der Übungsdatenbank vorhanden – zuerst unter „Übungen“ anlegen.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {fieldType === 'off_field' ? (
            <div>
              <Label>Off Field</Label>
              <ChipMultiPicker
                options={OFF_FIELD_FOCUS_OPTIONS.map((f) => ({ value: f, label: f }))}
                value={focusFilter}
                onChange={setFocusFilter}
              />
            </div>
          ) : (
            <>
              <div>
                <Label>On Field</Label>
                <ChipMultiPicker
                  options={ON_FIELD_FOCUS_OPTIONS.map((f) => ({ value: f, label: f }))}
                  value={focusFilter}
                  onChange={setFocusFilter}
                />
              </div>
              <div>
                <Label>Off Field</Label>
                <ChipMultiPicker
                  size="sm"
                  options={OFF_FIELD_FOCUS_OPTIONS.map((f) => ({ value: f, label: f }))}
                  value={focusFilter}
                  onChange={setFocusFilter}
                />
              </div>
            </>
          )}

          {availableOptions.length === 0 ? (
            <p className="text-sm text-text-muted">Keine Übungen für diese Auswahl gefunden.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selectedExerciseId}
                onChange={(e) => setSelectedExerciseId(e.target.value)}
                className="min-w-0 flex-1"
              >
                {availableOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min={1}
                value={newDuration}
                onChange={(e) => setNewDuration(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-xs text-text-muted">Min.</span>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleAdd()}>
                + Hinzufügen
              </Button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
