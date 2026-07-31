import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import {
  fetchPlayerGoalSeasons,
  fetchPlayerGoals,
  createPlayerGoalSeason,
  createPlayerGoal,
  updatePlayerGoal,
  deletePlayerGoal,
} from './api';
import type { PlayerGoalSeason, PlayerGoal } from '../../types/database';

interface PlayerGoalsProps {
  playerId: string;
  currentUserId: string | null;
  readOnly?: boolean;
}

export function PlayerGoals({ playerId, currentUserId, readOnly = false }: PlayerGoalsProps) {
  const [seasons, setSeasons] = useState<PlayerGoalSeason[] | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<PlayerGoalSeason | null>(null);
  const [goals, setGoals] = useState<PlayerGoal[] | null>(null);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalRating, setNewGoalRating] = useState<number>(3);
  const [newGoalNotes, setNewGoalNotes] = useState('');
  const [newSeason, setNewSeason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);

  async function loadSeasons() {
    try {
      const data = await fetchPlayerGoalSeasons(playerId);
      setSeasons(data);
      if (data.length > 0 && !selectedSeason) {
        setSelectedSeason(data[0]);
        loadGoals(data[0]);
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

  async function handleAddSeason() {
    if (!newSeason.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const seasonId = await createPlayerGoalSeason(playerId, newSeason.trim());
      setNewSeason('');
      await loadSeasons();
      setSelectedSeason(seasons?.find((s) => s.id === seasonId) || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saison konnte nicht erstellt werden.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddGoal() {
    if (!selectedSeason || !newGoalTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createPlayerGoal(selectedSeason.id, newGoalTitle.trim(), newGoalRating, newGoalNotes.trim() || null, currentUserId);
      setNewGoalTitle('');
      setNewGoalRating(3);
      setNewGoalNotes('');
      await loadGoals(selectedSeason);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ziel konnte nicht erstellt werden.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateGoal(goalId: string, goal: PlayerGoal) {
    setSaving(true);
    setError(null);
    try {
      await updatePlayerGoal(goalId, {
        title: goal.title,
        rating_stars: goal.rating_stars,
        notes: goal.notes,
      });
      if (selectedSeason) await loadGoals(selectedSeason);
      setEditingGoal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ziel konnte nicht aktualisiert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGoal(goalId: string) {
    const confirmed = window.confirm('Ziel wirklich löschen?');
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      await deletePlayerGoal(goalId);
      if (selectedSeason) await loadGoals(selectedSeason);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ziel konnte nicht gelöscht werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Saison</Label>
        <div className="flex gap-2">
          <select
            value={selectedSeason?.id ?? ''}
            onChange={(e) => {
              const season = seasons?.find((s) => s.id === e.target.value);
              if (season) {
                setSelectedSeason(season);
                void loadGoals(season);
              }
            }}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            disabled={readOnly}
          >
            <option value="">-- Wählen Sie eine Saison --</option>
            {seasons?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.season}
              </option>
            ))}
          </select>
          {!readOnly && (
            <>
              <Input
                placeholder="Neue Saison…"
                value={newSeason}
                onChange={(e) => setNewSeason(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={saving || !newSeason.trim()}
                onClick={() => void handleAddSeason()}
              >
                +
              </Button>
            </>
          )}
        </div>
      </div>

      {selectedSeason && (
        <div>
          <Label>Ziele für {selectedSeason.season}</Label>

          {!readOnly && (
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border p-3">
              <Input
                placeholder="Ziel hinzufügen…"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="rating">Beurteilung (Sterne)</Label>
                  <select
                    id="rating"
                    value={newGoalRating}
                    onChange={(e) => setNewGoalRating(parseInt(e.target.value, 10))}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                  >
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <option key={i} value={i}>
                        {i} Sterne
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Input
                placeholder="Notizen (optional)…"
                value={newGoalNotes}
                onChange={(e) => setNewGoalNotes(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={saving || !newGoalTitle.trim()}
                onClick={() => void handleAddGoal()}
              >
                Ziel hinzufügen
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          {goals === null && <p className="text-sm text-text-muted">Lädt…</p>}
          {goals?.length === 0 && <p className="text-sm text-text-muted">Noch keine Ziele für diese Saison.</p>}

          <div className="flex flex-col gap-2">
            {goals?.map((goal) => (
              <div key={goal.id} className="rounded-lg border border-border p-3">
                {editingGoal === goal.id && !readOnly ? (
                  <div className="flex flex-col gap-2">
                    <Input
                      value={goal.title}
                      onChange={(e) => setGoals(goals.map((g) => (g.id === goal.id ? { ...g, title: e.target.value } : g)))}
                    />
                    <select
                      value={goal.rating_stars ?? 3}
                      onChange={(e) =>
                        setGoals(goals.map((g) => (g.id === goal.id ? { ...g, rating_stars: parseInt(e.target.value, 10) } : g)))
                      }
                      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                    >
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <option key={i} value={i}>
                          {i} Sterne
                        </option>
                      ))}
                    </select>
                    <Input
                      value={goal.notes ?? ''}
                      onChange={(e) => setGoals(goals.map((g) => (g.id === goal.id ? { ...g, notes: e.target.value } : g)))}
                      placeholder="Notizen…"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={saving}
                        onClick={() => void handleUpdateGoal(goal.id, goal)}
                      >
                        Speichern
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingGoal(null)}>
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-text">{goal.title}</p>
                        <p className="mt-1 text-sm text-text-muted">{'⭐'.repeat(goal.rating_stars ?? 0)}</p>
                        {goal.notes && <p className="mt-1 text-sm text-text">{goal.notes}</p>}
                      </div>
                      {!readOnly && (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            onClick={() => setEditingGoal(goal.id)}
                          >
                            Bearbeiten
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            className="px-2 py-1 text-xs"
                            disabled={saving}
                            onClick={() => void handleDeleteGoal(goal.id)}
                          >
                            Löschen
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
