import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { StarRating } from '../../components/StarRating';
import { fetchTrainingRatings, saveRegularRating } from './api';
import type { TrainingRatingState } from './api';
import { useAuth } from '../../auth/AuthContext';

interface TrainingRatingSectionProps {
  trainingId: string;
}

export function TrainingRatingSection({ trainingId }: TrainingRatingSectionProps) {
  const { profile } = useAuth();
  const [state, setState] = useState<TrainingRatingState | null>(null);
  const [stars, setStars] = useState(0);
  const [notes, setNotes] = useState('');
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

  if (!state) return <p className="text-sm text-text-muted">Lädt…</p>;

  return (
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
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
