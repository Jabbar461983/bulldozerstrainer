import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { StarRating } from '../../components/StarRating';
import { fetchGameRatings, saveGameRating, GAME_RATING_CATEGORIES } from './api';
import type { GameRating } from '../../types/database';
import { useAuth } from '../../auth/AuthContext';

interface GameRatingSectionProps {
  gameId: string;
}

interface CategoryState {
  id: string | null;
  stars: number;
  notes: string;
  saving: boolean;
}

export function GameRatingSection({ gameId }: GameRatingSectionProps) {
  const { profile } = useAuth();
  const [state, setState] = useState<Record<string, CategoryState> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const ratings = await fetchGameRatings(gameId);
      const byCategory = new Map(ratings.map((r: GameRating) => [r.category, r]));
      const next: Record<string, CategoryState> = {};
      for (const cat of GAME_RATING_CATEGORIES) {
        const existing = byCategory.get(cat.value);
        next[cat.value] = {
          id: existing?.id ?? null,
          stars: existing?.stars ?? 0,
          notes: existing?.notes ?? '',
          saving: false,
        };
      }
      setState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bewertungen konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  function updateCategory(category: string, patch: Partial<CategoryState>) {
    setState((prev) => (prev ? { ...prev, [category]: { ...prev[category], ...patch } } : prev));
  }

  async function handleSave(category: string) {
    if (!state) return;
    const row = state[category];
    if (row.stars === 0) return;
    updateCategory(category, { saving: true });
    setError(null);
    try {
      await saveGameRating(gameId, row.id, category as GameRating['category'], row.stars, row.notes || null, profile?.id ?? null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bewertung konnte nicht gespeichert werden.');
      updateCategory(category, { saving: false });
    }
  }

  if (!state) return <p className="text-sm text-text-muted">Lädt…</p>;

  return (
    <div className="flex flex-col gap-3">
      {GAME_RATING_CATEGORIES.map((cat) => {
        const row = state[cat.value];
        return (
          <div key={cat.value} className="flex flex-col gap-1.5 rounded-xl border border-border p-2">
            <p className="text-sm font-medium text-text">{cat.label}</p>
            <StarRating value={row.stars} onChange={(v) => updateCategory(cat.value, { stars: v })} size="sm" />
            <textarea
              rows={2}
              placeholder="Notizen (optional)"
              value={row.notes}
              onChange={(e) => updateCategory(cat.value, { notes: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={row.saving || row.stars === 0}
              onClick={() => void handleSave(cat.value)}
              className="self-start"
            >
              {row.saving ? 'Speichern…' : 'Speichern'}
            </Button>
          </div>
        );
      })}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
