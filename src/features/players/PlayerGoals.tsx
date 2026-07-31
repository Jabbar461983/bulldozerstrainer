import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { fetchPlayerGoalSeasons, fetchPlayerGoals, createPlayerGoal } from './api';
import type { PlayerGoalSeason, PlayerGoal } from '../../types/database';

interface PlayerGoalsProps {
  playerId: string;
  currentUserId: string | null;
  defaultSeason?: string;
}

export function PlayerGoals({ playerId, currentUserId, defaultSeason }: PlayerGoalsProps) {
  const [selectedSeason, setSelectedSeason] = useState<PlayerGoalSeason | null>(null);
  const [goals, setGoals] = useState<PlayerGoal[] | null>(null);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalRating, setNewGoalRating] = useState<number>(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSeasons() {
    try {
      const data = await fetchPlayerGoalSeasons(playerId);

      // Auto-select season based on default or first available
      const seasonToSelect = data.find((s) => s.season === defaultSeason) || data[0];
      if (seasonToSelect && !selectedSeason) {
        setSelectedSeason(seasonToSelect);
        await loadGoals(seasonToSelect);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saisons konnten nicht geladen werden.');
    }
  }

  async function loadGoals(season: PlayerGoalSeason) {
    try {
      const data = await fetchPlayerGoals(season.id);
      setGoals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ziele konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void loadSeasons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  async function handleAddGoal() {
    if (!selectedSeason || !newGoalTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createPlayerGoal(selectedSeason.id, newGoalTitle.trim(), newGoalRating, null, currentUserId);
      setNewGoalTitle('');
      setNewGoalRating(3);
      await loadGoals(selectedSeason);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ziel konnte nicht erstellt werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-danger">{error}</p>}

      {selectedSeason && (
        <div className="flex flex-col gap-2">
          <div>
            <Label className="text-xs">Saison</Label>
            <p className="text-sm font-medium text-text">{selectedSeason.season}</p>
          </div>

          <div>
            <Label htmlFor="goal-input" className="text-xs">
              Ziel hinzufügen
            </Label>
            <div className="flex gap-2">
              <Input
                id="goal-input"
                placeholder="Ziel eingeben…"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                className="flex-1"
              />
              <select
                value={newGoalRating}
                onChange={(e) => setNewGoalRating(parseInt(e.target.value, 10))}
                className="rounded-lg border border-border bg-surface px-2 py-2 text-xs text-text"
                title="Beurteilung"
              >
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <option key={i} value={i}>
                    {i}★
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                disabled={saving || !newGoalTitle.trim()}
                onClick={() => void handleAddGoal()}
              >
                +
              </Button>
            </div>
          </div>

          {goals === null && <p className="text-xs text-text-muted">Lädt…</p>}
          {goals?.length === 0 && <p className="text-xs text-text-muted">Keine Ziele</p>}

          {goals && goals.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {goals.map((goal) => (
                <div key={goal.id} className="rounded border border-border bg-surface-alt p-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-text">{goal.title}</p>
                      <p className="text-text-muted">{'⭐'.repeat(goal.rating_stars ?? 0)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
