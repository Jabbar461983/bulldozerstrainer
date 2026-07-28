import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { ChipMultiPicker } from '../../components/ChipMultiPicker';
import { ExerciseMediaGallery } from './ExerciseMediaGallery';
import { EXERCISE_FOCUS_OPTIONS, updateExercise } from './api';
import type { ExerciseRow } from './api';
import type { Category, ExerciseFocus } from '../../types/database';

interface EditExerciseDialogProps {
  exercise: ExerciseRow;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditExerciseDialog({ exercise, categories, onClose, onSaved }: EditExerciseDialogProps) {
  const [title, setTitle] = useState(exercise.title);
  const [description, setDescription] = useState(exercise.description ?? '');
  const [focusAreas, setFocusAreas] = useState<string[]>(exercise.focus_areas);
  const [categoryIds, setCategoryIds] = useState<string[]>(exercise.age_category_ids);
  const [media, setMedia] = useState(exercise.media);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateExercise(exercise.id, {
        title,
        description: description || null,
        focus_areas: focusAreas as ExerciseFocus[],
        age_category_ids: categoryIds,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Änderungen konnten nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={`„${exercise.title}“ bearbeiten`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Schliessen
          </Button>
          <Button type="submit" form="edit-exercise-form" disabled={loading}>
            {loading ? 'Speichern…' : 'Speichern'}
          </Button>
        </>
      }
    >
      <form id="edit-exercise-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <Label>Bilder/Videos</Label>
          <ExerciseMediaGallery exerciseId={exercise.id} media={media} onChange={setMedia} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
