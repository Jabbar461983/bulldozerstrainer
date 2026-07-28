import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ChipMultiPicker } from '../../components/ChipMultiPicker';
import { useAuth } from '../../auth/AuthContext';
import { fetchExercises, deleteExercise, EXERCISE_FOCUS_OPTIONS } from './api';
import type { ExerciseRow } from './api';
import { fetchCategories } from '../../lib/categories';
import type { Category, ExerciseFocus } from '../../types/database';
import { CreateExerciseDialog } from './CreateExerciseDialog';
import { EditExerciseDialog } from './EditExerciseDialog';

export function ExercisesPage() {
  const { profile, isAdmin } = useAuth();
  const [exercises, setExercises] = useState<ExerciseRow[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [focusFilter, setFocusFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseRow | null>(null);

  async function load() {
    setError(null);
    try {
      const [exerciseRows, categoryRows] = await Promise.all([fetchExercises(), fetchCategories()]);
      setExercises(exerciseRows);
      setCategories(categoryRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übungen konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filteredExercises = useMemo(() => {
    if (!exercises) return null;
    return exercises.filter((ex) => {
      const matchesFocus =
        focusFilter.length === 0 || focusFilter.some((f) => ex.focus_areas.includes(f as ExerciseFocus));
      const matchesCategory =
        categoryFilter.length === 0 || categoryFilter.some((c) => ex.age_category_ids.includes(c));
      return matchesFocus && matchesCategory;
    });
  }, [exercises, focusFilter, categoryFilter]);

  async function handleDelete(exercise: ExerciseRow) {
    const confirmed = window.confirm(`Übung „${exercise.title}“ wirklich unwiderruflich löschen?`);
    if (!confirmed) return;
    setBusyId(exercise.id);
    setError(null);
    try {
      await deleteExercise(
        exercise.id,
        exercise.media.map((m) => ({ type: m.type, path: m.path, url: '' })),
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übung konnte nicht gelöscht werden.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">Übungsdatenbank</h1>
        <Button onClick={() => setShowCreate(true)}>+ Neue Übung</Button>
      </div>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-2">
        <ChipMultiPicker
          options={EXERCISE_FOCUS_OPTIONS.map((f) => ({ value: f, label: f }))}
          value={focusFilter}
          onChange={setFocusFilter}
        />
        {categories.length > 0 && (
          <ChipMultiPicker
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
        )}
      </div>

      {filteredExercises === null && <p className="text-sm text-text-muted">Lädt…</p>}
      {filteredExercises?.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Keine Übungen gefunden.</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {filteredExercises?.map((exercise) => {
          const canEdit = isAdmin || exercise.author_id === profile?.id;
          return (
            <Card key={exercise.id} className="flex flex-col gap-3">
              <div>
                <p className="font-medium text-text">{exercise.title}</p>
                {exercise.description && <p className="mt-1 text-sm text-text-muted">{exercise.description}</p>}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {exercise.focus_areas.map((f) => (
                  <span key={f} className="rounded-full bg-surface-alt px-2.5 py-1 text-xs text-text-muted">
                    {f}
                  </span>
                ))}
                {exercise.age_category_ids.map((id) => (
                  <span key={id} className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent">
                    {categoryById.get(id)?.name ?? '?'}
                  </span>
                ))}
              </div>

              {exercise.media.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {exercise.media.map((m) =>
                    m.type === 'image' ? (
                      <img
                        key={m.path}
                        src={m.url ?? ''}
                        alt=""
                        className="size-20 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <video key={m.path} src={m.url ?? ''} controls className="h-20 w-32 rounded-lg border border-border" />
                    ),
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <Button variant="secondary" onClick={() => setEditingExercise(exercise)}>
                    Bearbeiten
                  </Button>
                )}
                {isAdmin && (
                  <Button variant="danger" disabled={busyId === exercise.id} onClick={() => void handleDelete(exercise)}>
                    Löschen
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {showCreate && (
        <CreateExerciseDialog
          categories={categories}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}

      {editingExercise && (
        <EditExerciseDialog
          exercise={editingExercise}
          categories={categories}
          onClose={() => setEditingExercise(null)}
          onSaved={() => {
            setEditingExercise(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
