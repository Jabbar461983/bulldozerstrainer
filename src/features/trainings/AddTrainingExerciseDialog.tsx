import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { fetchCategories } from '../../lib/categories';
import { fetchExerciseOptions } from '../exercises/api';
import type { ExerciseOption } from '../exercises/api';
import type { Category } from '../../types/database';

interface AddTrainingExerciseDialogProps {
  onClose: () => void;
  onAdd: (exerciseId: string) => Promise<void>;
}

export function AddTrainingExerciseDialog({ onClose, onAdd }: AddTrainingExerciseDialogProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchCategories(), fetchExerciseOptions()])
      .then(([categoryRows, exerciseRows]) => {
        setCategories(categoryRows);
        setExercises(exerciseRows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Daten konnten nicht geladen werden.'))
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

  const filteredExercises = selectedCategoryId
    ? exercises.filter((e) => e.age_category_ids.includes(selectedCategoryId))
    : [];

  return (
    <Modal title={selectedCategoryId ? 'Übung auswählen' : 'Kategorie auswählen'} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {loading && <p className="text-sm text-text-muted">Lädt…</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        {!loading && !selectedCategoryId && (
          <>
            {categories.length === 0 && (
              <p className="text-sm text-text-muted">Keine Alterskategorien vorhanden.</p>
            )}
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategoryId(c.id)}
                className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-left text-sm font-medium text-text hover:bg-surface-alt"
              >
                {c.name}
                <span className="text-xs font-normal text-text-muted">
                  {exercises.filter((e) => e.age_category_ids.includes(c.id)).length} Übungen
                </span>
              </button>
            ))}
          </>
        )}

        {!loading && selectedCategoryId && (
          <>
            <Button type="button" variant="ghost" onClick={() => setSelectedCategoryId(null)} className="self-start">
              ← Kategorie wechseln
            </Button>
            {filteredExercises.length === 0 && (
              <p className="text-sm text-text-muted">Keine Übungen für diese Kategorie vorhanden.</p>
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
