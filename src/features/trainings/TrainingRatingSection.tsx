import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { StarRating } from '../../components/StarRating';
import { fetchTrainingRatings, saveRegularRating, addAdminFeedback, deleteRating } from './api';
import type { TrainingRatingState } from './api';
import { useAuth } from '../../auth/AuthContext';

interface TrainingRatingSectionProps {
  trainingId: string;
}

export function TrainingRatingSection({ trainingId }: TrainingRatingSectionProps) {
  const { profile, isAdmin } = useAuth();
  const [state, setState] = useState<TrainingRatingState | null>(null);
  const [stars, setStars] = useState(0);
  const [notes, setNotes] = useState('');
  const [feedbackStars, setFeedbackStars] = useState(0);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const result = await fetchTrainingRatings(trainingId);
      setState(result);
      setStars(result.regular?.stars ?? 0);
      setNotes(result.regular?.notes ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bewertung konnte nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingId]);

  async function handleSave() {
    if (stars === 0) return;
    setBusy(true);
    setError(null);
    try {
      await saveRegularRating(trainingId, state?.regular?.id ?? null, stars, notes || null, profile?.id ?? null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bewertung konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddFeedback() {
    if (feedbackStars === 0) return;
    setBusy(true);
    setError(null);
    try {
      await addAdminFeedback(trainingId, feedbackStars, feedbackNotes || null, profile?.id ?? null);
      setFeedbackStars(0);
      setFeedbackNotes('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feedback konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteFeedback(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteRating(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feedback konnte nicht gelöscht werden.');
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <p className="text-sm text-text-muted">Lädt…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <StarRating value={stars} onChange={setStars} />
        <textarea
          rows={2}
          placeholder="Notizen zur Trainingseinheit (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <Button type="button" disabled={busy || stars === 0} onClick={() => void handleSave()} className="self-start">
          Bewertung speichern
        </Button>
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-sm font-medium text-text">Admin-Feedback</p>
          {state.adminFeedback.length === 0 && (
            <p className="text-sm text-text-muted">Noch kein Admin-Feedback.</p>
          )}
          {state.adminFeedback.map((f) => (
            <div key={f.id} className="flex flex-col gap-1 rounded-xl border border-border p-2">
              <div className="flex items-center justify-between">
                <StarRating value={f.stars} readOnly size="sm" />
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void handleDeleteFeedback(f.id)}
                  aria-label="Feedback löschen"
                >
                  ✕
                </Button>
              </div>
              {f.notes && <p className="text-sm text-text-muted">{f.notes}</p>}
            </div>
          ))}

          <StarRating value={feedbackStars} onChange={setFeedbackStars} size="sm" />
          <textarea
            rows={2}
            placeholder="Neues Admin-Feedback (optional)"
            value={feedbackNotes}
            onChange={(e) => setFeedbackNotes(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy || feedbackStars === 0}
            onClick={() => void handleAddFeedback()}
            className="self-start"
          >
            + Feedback hinzufügen
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
