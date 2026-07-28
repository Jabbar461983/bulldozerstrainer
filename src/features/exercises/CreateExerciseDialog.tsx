import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { ChipMultiPicker } from '../../components/ChipMultiPicker';
import { EXERCISE_FOCUS_OPTIONS, createExercise } from './api';
import type { Category, ExerciseFocus } from '../../types/database';
import { useAuth } from '../../auth/AuthContext';

interface CreateExerciseDialogProps {
  categories: Category[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreateExerciseDialog({ categories, onClose, onCreated }: CreateExerciseDialogProps) {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...selected]);
    e.target.value = '';
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createExercise({
        title,
        description: description || null,
        focus_areas: focusAreas as ExerciseFocus[],
        age_category_ids: categoryIds,
        files,
        author_id: profile?.id ?? null,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übung konnte nicht angelegt werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Neue Übung anlegen"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="create-exercise-form" disabled={loading}>
            {loading ? 'Anlegen…' : 'Übung anlegen'}
          </Button>
        </>
      }
    >
      <form id="create-exercise-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="title">Titel</Label>
          <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="description">Beschreibung (optional)</Label>
          <textarea
            id="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <Label>Fokus-Bereiche</Label>
          <ChipMultiPicker
            options={EXERCISE_FOCUS_OPTIONS.map((f) => ({ value: f, label: f }))}
            value={focusAreas}
            onChange={setFocusAreas}
          />
        </div>
        <div>
          <Label>Alterskategorien</Label>
          <ChipMultiPicker
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={categoryIds}
            onChange={setCategoryIds}
          />
        </div>

        <div>
          <Label htmlFor="media">Bilder/Videos (optional, max. 50 MB pro Datei)</Label>
          <input
            id="media"
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFiles}
            className="block w-full text-sm text-text file:mr-3 file:rounded-xl file:border-0 file:bg-surface-alt file:px-3.5 file:py-2.5 file:text-sm file:font-medium file:text-text"
          />
          {files.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {files.map((file, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm text-text"
                >
                  <span className="truncate">{file.name}</span>
                  <Button type="button" variant="ghost" onClick={() => removeFile(i)} aria-label="Datei entfernen">
                    ✕
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
