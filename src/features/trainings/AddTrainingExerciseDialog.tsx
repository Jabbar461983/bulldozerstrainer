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
  const [previewId, setPreviewId] = useState<string | null>(null);
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

  const previewExercise = previewId ? (exercises.find((e) => e.id === previewId) ?? null) : null;

  const title = previewExercise
    ? previewExercise.title
    : selection
      ? 'Übung auswählen'
      : 'Inhalt auswählen';

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {loading && <p className="text-sm text-text-muted">Lädt…</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        {!loading && !selection && !previewExercise && (
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

        {!loading && selection && !previewExercise && (
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
                <div
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5 text-sm transition hover:bg-surface-alt"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewId(e.id)}
                    className="min-w-0 flex-1 text-left font-medium text-text hover:text-accent hover:underline"
                  >
                    {e.title}
                  </button>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      disabled={adding === e.id}
                      onClick={() => void handleSelectExercise(e.id)}
                      aria-label="Übung ins Training übernehmen"
                      className="block disabled:opacity-50"
                    >
                      {thumbnail ? (
                        <img
                          src={thumbnail.url ?? ''}
                          alt=""
                          className="h-24 w-36 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <span className="flex h-24 w-36 items-center justify-center rounded-lg border border-dashed border-border text-xs text-text-muted">
                          Keine Skizze
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={adding === e.id}
                      onClick={() => void handleSelectExercise(e.id)}
                      aria-label="Übung ins Training übernehmen"
                      className="absolute -bottom-2 -right-2 flex size-9 items-center justify-center rounded-full border-2 border-surface bg-accent text-lg font-bold leading-none text-accent-foreground shadow transition hover:brightness-110 disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {!loading && previewExercise && (
          <div className="flex flex-col gap-3">
            <Button type="button" variant="ghost" onClick={() => setPreviewId(null)} className="self-start">
              ← Zurück
            </Button>

            {(mediaByExercise.get(previewExercise.id) ?? [])
              .filter((m) => m.type === 'image' && m.url)
              .map((m) => (
                <img
                  key={m.path}
                  src={m.url ?? ''}
                  alt=""
                  className="w-full rounded-xl border border-border object-contain"
                />
              ))}

            {previewExercise.description && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-text-muted">Beschreibung</h3>
                <p className="whitespace-pre-wrap text-sm text-text">{previewExercise.description}</p>
              </div>
            )}

            {previewExercise.coaching_questions && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-text-muted">Coachingfragen</h3>
                <p className="whitespace-pre-wrap text-sm text-text">{previewExercise.coaching_questions}</p>
              </div>
            )}

            {previewExercise.variants && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-text-muted">Varianten</h3>
                <p className="whitespace-pre-wrap text-sm text-text">{previewExercise.variants}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button type="button" variant="secondary" onClick={() => setPreviewId(null)}>
                Zurück
              </Button>
              <Button
                type="button"
                disabled={adding === previewExercise.id}
                onClick={() => void handleSelectExercise(previewExercise.id)}
              >
                {adding === previewExercise.id ? 'Wird hinzugefügt…' : '+ Übernehmen'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
