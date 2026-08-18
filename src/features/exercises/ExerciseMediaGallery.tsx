import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { fetchExercise, addExerciseMedia, removeExerciseMedia } from './api';
import type { ExerciseMediaView } from './api';
import type { ExerciseMedia } from '../../types/database';

interface ExerciseMediaGalleryProps {
  exerciseId: string;
  title: string;
  media: ExerciseMediaView[];
  onChange: (media: ExerciseMediaView[]) => void;
}

export function ExerciseMediaGallery({ exerciseId, title, media, onChange }: ExerciseMediaGalleryProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const fresh = await fetchExercise(exerciseId);
    onChange(fresh.media);
  }

  async function handleAddFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const existingRaw: ExerciseMedia[] = media.map((m) => ({ type: m.type, path: m.path, url: '' }));
      await addExerciseMedia(exerciseId, title, existingRaw, files);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Datei konnte nicht hochgeladen werden.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(path: string) {
    setBusy(true);
    setError(null);
    try {
      const existingRaw: ExerciseMedia[] = media.map((m) => ({ type: m.type, path: m.path, url: '' }));
      await removeExerciseMedia(exerciseId, existingRaw, path);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Datei konnte nicht entfernt werden.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {media.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {media.map((m) => (
            <div key={m.path} className="relative">
              {m.type === 'image' ? (
                <img src={m.url ?? ''} alt="" className="size-20 rounded-lg border border-border object-cover" />
              ) : (
                <video src={m.url ?? ''} controls className="h-20 w-32 rounded-lg border border-border" />
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRemove(m.path)}
                aria-label="Datei entfernen"
                className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-danger text-xs text-white disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        type="file"
        multiple
        accept="image/*,video/*"
        disabled={busy}
        onChange={(e) => void handleAddFiles(e)}
        className="block w-full text-sm text-text file:mr-3 file:rounded-xl file:border-0 file:bg-surface-alt file:px-3.5 file:py-2.5 file:text-sm file:font-medium file:text-text"
      />
      {busy && <p className="text-sm text-text-muted">Wird verarbeitet…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
