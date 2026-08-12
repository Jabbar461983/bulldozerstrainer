import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import {
  fetchExerciseOptions,
  fetchExerciseMediaByIds,
  fetchFavoriteExerciseIds,
  ON_FIELD_FOCUS_OPTIONS,
  OFF_FIELD_FOCUS_OPTIONS,
} from '../exercises/api';
import type { ExerciseOption, ExerciseMediaView } from '../exercises/api';
import { useAuth } from '../../auth/AuthContext';
import type { ExerciseFocus, TrainingFieldType } from '../../types/database';

interface AddTrainingExerciseDialogProps {
  fieldType: TrainingFieldType;
  categoryId: string;
  onClose: () => void;
  onAdd: (exerciseId: string) => Promise<void>;
}

type ContentSelection = { kind: 'favorites' } | { kind: 'focus'; focus: ExerciseFocus };

export function AddTrainingExerciseDialog({ fieldType, categoryId, onClose, onAdd }: AddTrainingExerciseDialogProps) {
  const { profile } = useAuth();
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [mediaByExercise, setMediaByExercise] = useState<Map<string, ExerciseMediaView[]>>(new Map());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<ContentSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExerciseOptions()
      .then(async (options) => {
        setExercises(options);
        const [media, favorites] = await Promise.all([
          fetchExerciseMediaByIds(options.map((o) => o.id)),
          profile?.id ? fetchFavoriteExerciseIds(profile.id) : Promise.resolve(new Set<string>()),
        ]);
        setMediaByExercise(media);
        setFavoriteIds(favorites);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Übungen konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [profile?.id]);

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

  const categoryExercises = useMemo(
    () => exercises.filter((e) => e.age_category_ids.includes(categoryId)),
    [exercises, categoryId],
  );

  const fieldExercises = useMemo(() => {
    if (fieldType !== 'off_field') return categoryExercises;
    return categoryExercises.filter((e) => e.focus_areas.some((f) => OFF_FIELD_FOCUS_OPTIONS.includes(f)));
  }, [categoryExercises, fieldType]);

  const favoriteFieldExercises = useMemo(
    () => fieldExercises.filter((e) => favoriteIds.has(e.id)),
    [fieldExercises, favoriteIds],
  );

  const filteredExercises = useMemo(() => {
    if (!selection) return [];
    if (selection.kind === 'favorites') return favoriteFieldExercises;
    return fieldExercises.filter((e) => e.focus_areas.includes(selection.focus));
  }, [fieldExercises, favoriteFieldExercises, selection]);

  return (
    <Modal title={selection ? 'Übung auswählen' : 'Inhalt auswählen'} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {loading && <p className="text-sm text-text-muted">Lädt…</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        {!loading && !selection && (
          <>
            {fieldExercises.length === 0 && (
              <p className="text-sm text-text-muted">
                Für die Alterskategorie dieses Teams sind noch keine passenden Übungen hinterlegt.
              </p>
            )}

            <button
              type="button"
              onClick={() => setSelection({ kind: 'favorites' })}
              className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/5 px-3.5 py-2.5 text-left text-sm font-medium text-text hover:bg-accent/10"
            >
              ★ Persönliche Favoriten
              <span className="text-xs font-normal text-text-muted">{favoriteFieldExercises.length} Übungen</span>
            </button>

            {fieldType === 'off_field' ? (
              OFF_FIELD_FOCUS_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelection({ kind: 'focus', focus: f })}
                  className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-left text-sm font-medium text-text hover:bg-surface-alt"
                >
                  {f}
                  <span className="text-xs font-normal text-text-muted">
                    {fieldExercises.filter((e) => e.focus_areas.includes(f)).length} Übungen
                  </span>
                </button>
              ))
            ) : (
              <>
                {ON_FIELD_FOCUS_OPTIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSelection({ kind: 'focus', focus: f })}
                    className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-left text-sm font-medium text-text hover:bg-surface-alt"
                  >
                    {f}
                    <span className="text-xs font-normal text-text-muted">
                      {fieldExercises.filter((e) => e.focus_areas.includes(f)).length} Übungen
                    </span>
                  </button>
                ))}

                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-text-muted">Off Field</p>
                {OFF_FIELD_FOCUS_OPTIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSelection({ kind: 'focus', focus: f })}
                    className="flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5 text-left text-xs font-medium text-text-muted hover:bg-surface-alt"
                  >
                    {f}
                    <span className="text-xs font-normal text-text-muted">
                      {fieldExercises.filter((e) => e.focus_areas.includes(f)).length} Übungen
                    </span>
                  </button>
                ))}
              </>
            )}
          </>
        )}

        {!loading && selection && (
          <>
            <Button type="button" variant="ghost" onClick={() => setSelection(null)} className="self-start">
              ← Inhalt wechseln
            </Button>

            {filteredExercises.length === 0 && (
              <p className="text-sm text-text-muted">Keine Übungen für diese Auswahl vorhanden.</p>
            )}
            {filteredExercises.map((e) => {
              const thumbnail = mediaByExercise.get(e.id)?.find((m) => m.type === 'image' && m.url);
              return (
                <button
                  key={e.id}
                  type="button"
                  disabled={adding === e.id}
                  onClick={() => void handleSelectExercise(e.id)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5 text-left text-sm font-medium text-text hover:bg-surface-alt disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {adding === e.id ? 'Wird hinzugefügt…' : e.title}
                  </span>
                  {thumbnail && (
                    <img
                      src={thumbnail.url ?? ''}
                      alt=""
                      className="h-12 w-16 shrink-0 rounded-lg border border-border object-cover"
                    />
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>
    </Modal>
  );
}
