import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { ChipMultiPicker } from '../../components/ChipMultiPicker';
import { ExerciseMediaGallery } from './ExerciseMediaGallery';
import { ON_FIELD_FOCUS_OPTIONS, OFF_FIELD_FOCUS_OPTIONS, updateExercise, fetchExercise, addExerciseMedia } from './api';
import type { ExerciseRow } from './api';
import type { Category, ExerciseFocus } from '../../types/database';
import { ExerciseSketchEditor } from './sketch/ExerciseSketchEditor';

interface EditExerciseDialogProps {
  exercise: ExerciseRow;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditExerciseDialog({ exercise, categories, onClose, onSaved }: EditExerciseDialogProps) {
  const [title, setTitle] = useState(exercise.title);
  const [learningContent, setLearningContent] = useState(exercise.learning_content ?? '');
  const [description, setDescription] = useState(exercise.description ?? '');
  const [variants, setVariants] = useState(exercise.variants ?? '');
  const [focusAreas, setFocusAreas] = useState<string[]>(exercise.focus_areas);
  const [categoryIds, setCategoryIds] = useState<string[]>(exercise.age_category_ids);
  const [media, setMedia] = useState(exercise.media);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSketchEditor, setShowSketchEditor] = useState(false);

  async function handleSketchSave(jpegBlob: Blob) {
    const file = new File([jpegBlob], `Skizze-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const existingRaw = media.map((m) => ({ type: m.type, path: m.path, url: '' }));
    await addExerciseMedia(exercise.id, title, existingRaw, [file]);
    const fresh = await fetchExercise(exercise.id);
    setMedia(fresh.media);
    setShowSketchEditor(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateExercise(exercise.id, {
        title,
        learning_content: learningContent || null,
        description: description || null,
        variants: variants || null,
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
          <Label htmlFor="learningContent">Lerninhalte (optional)</Label>
          <textarea
            id="learningContent"
            rows={3}
            value={learningContent}
            onChange={(e) => setLearningContent(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
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
          <Label htmlFor="variants">Varianten (optional)</Label>
          <textarea
            id="variants"
            rows={3}
            value={variants}
            onChange={(e) => setVariants(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <Label>On Field</Label>
            <ChipMultiPicker
              options={ON_FIELD_FOCUS_OPTIONS.map((f) => ({ value: f, label: f }))}
              value={focusAreas}
              onChange={setFocusAreas}
            />
          </div>
          <div>
            <Label>Off Field</Label>
            <ChipMultiPicker
              options={OFF_FIELD_FOCUS_OPTIONS.map((f) => ({ value: f, label: f }))}
              value={focusAreas}
              onChange={setFocusAreas}
            />
          </div>
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
          <div className="flex items-center justify-between gap-2">
            <Label>Bilder/Videos</Label>
            <Button type="button" variant="secondary" onClick={() => setShowSketchEditor(true)}>
              Übung zeichnen
            </Button>
          </div>
          <ExerciseMediaGallery exerciseId={exercise.id} title={exercise.title} media={media} onChange={setMedia} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>

      {showSketchEditor && (
        <ExerciseSketchEditor onClose={() => setShowSketchEditor(false)} onSave={handleSketchSave} />
      )}
    </Modal>
  );
}
