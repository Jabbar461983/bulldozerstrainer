import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { fetchExerciseOptions, EXERCISE_FOCUS_OPTIONS, OFF_FIELD_FOCUS_OPTIONS } from '../exercises/api';
import type { ExerciseOption } from '../exercises/api';
import type { ExerciseFocus, TrainingFieldType } from '../../types/database';

interface AddTrainingExerciseDialogProps {
  fieldType: TrainingFieldType;
  categoryId: string;
  onClose: () => void;
  onAdd: (exerciseId: string) => Promise<void>;
}

export function AddTrainingExerciseDialog({ fieldType, categoryId, onClose, onAdd }: AddTrainingExerciseDialogProps) {
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [selectedFocus, setSelectedFocus] = useState<ExerciseFocus | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExerciseOptions()
      .then(setExercises)
      .catch((err) => setError(err instanceof Error ? err.message : 'Übungen konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSelectExercise(exerciseId: string) {
    setAdding(exerciseId);
    setError(null);
    try {
      await onAdd(exerciseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übung konnte nicht hinzugefügt werden.');
      setAdding(null);
    }
  }

  const focusOptions = fieldType === 'off_field' ? OFF_FIELD_FOCUS_OPTIONS : EXERCISE_FOCUS_OPTIONS;

  const categoryExercises = useMemo(
    () => exercises.filter((e) => e.age_category_ids.includes(categoryId)),
    [exercises, categoryId],
  );

  const fieldExercises = useMemo(() => {
    if (fieldType !== 'off_field') return categoryExercises;
    return categoryExercises.filter((e) => e.focus_areas.some((f) => OFF_FIELD_FOCUS_OPTIONS.includes(f)));
  }, [categoryExercises, fieldType]);

  const filteredExercises = useMemo(() => {
    if (!selectedFocus) return [];
    return fieldExercises.filter((e) => e.focus_areas.includes(selectedFocus));
  }, [fieldExercises, selectedFocus]);

  return (
    <Modal title={selectedFocus ? 'Übung auswählen' : 'Inhalt auswählen'} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {loading && <p className="text-sm text-text-muted">Lädt…</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        {!loading && !selectedFocus && (
          <>
            {fieldExercises.length === 0 && (
              <p className="text-sm text-text-muted">
                Für die Alterskategorie dieses Teams sind noch keine passenden Übungen hinterlegt.
              </p>
            )}
            {focusOptions.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedFocus(f)}
                className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-left text-sm font-medium text-text hover:bg-surface-alt"
              >
                {f}
                <span className="text-xs font-normal text-text-muted">
                  {fieldExercises.filter((e) => e.focus_areas.includes(f)).length} Übungen
                </span>
              </button>
            ))}
          </>
        )}

        {!loading && selectedFocus && (
          <>
            <Button type="button" variant="ghost" onClick={() => setSelectedFocus(null)} className="self-start">
              ← Inhalt wechseln
            </Button>

            {filteredExercises.length === 0 && (
              <p className="text-sm text-text-muted">Keine Übungen für diese Auswahl vorhanden.</p>
            )}
            {filteredExercises.map((e) => (
              <button
                key={e.id}
                type="button"
                disabled={adding === e.id}
                onClick={() => void handleSelectExercise(e.id)}
                className="rounded-xl border border-border px-3.5 py-2.5 text-left text-sm font-medium text-text hover:bg-surface-alt disabled:opacity-50"
              >
                {adding === e.id ? 'Wird hinzugefügt…' : e.title}
              </button>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}
