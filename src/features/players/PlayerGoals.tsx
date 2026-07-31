import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { Modal } from '../../components/Modal';
import {
  fetchPlayerGoalSeasons,
  fetchPlayerGoals,
  createPlayerGoal,
  createPlayerGoalSeason,
  updatePlayerGoal,
  deletePlayerGoal,
} from './api';
import type { PlayerGoalSeason, PlayerGoal } from '../../types/database';

interface PlayerGoalsProps {
  playerId: string;
  currentUserId: string | null;
  defaultSeason?: string;
  isAdmin?: boolean;
}

interface EditingGoal extends PlayerGoal {
  tempNotes: string;
  tempRating: number;
}

export function PlayerGoals({ playerId, currentUserId, defaultSeason, isAdmin = false }: PlayerGoalsProps) {
  const [selectedSeason, setSelectedSeason] = useState<PlayerGoalSeason | null>(null);
  const [goals, setGoals] = useState<PlayerGoal[] | null>(null);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<EditingGoal | null>(null);

  async function loadSeasons() {
    try {
      const data = await fetchPlayerGoalSeasons(playerId);

      // If no seasons exist and we have a defaultSeason, create it
      let seasonToSelect = data.find((s) => s.season === defaultSeason) || data[0];

      if (!seasonToSelect && defaultSeason) {
        // Auto-create the default season
        try {
          await createPlayerGoalSeason(playerId, defaultSeason);
          // Reload seasons after creating
          const newData = await fetchPlayerGoalSeasons(playerId);
          seasonToSelect = newData.find((s) => s.season === defaultSeason) || newData[0];
        } catch (err) {
          console.error('Failed to create default season:', err);
        }
      }

      if (seasonToSelect) {
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
      await createPlayerGoal(selectedSeason.id, newGoalTitle.trim(), null, null, currentUserId);
      setNewGoalTitle('');
      await loadGoals(selectedSeason);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ziel konnte nicht erstellt werden.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingGoal) return;
    setSaving(true);
    setError(null);
    try {
      await updatePlayerGoal(editingGoal.id, {
        title: editingGoal.title,
        rating_stars: editingGoal.tempRating || null,
        notes: editingGoal.tempNotes || null,
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
    if (!isAdmin) return;
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

  if (!selectedSeason) {
    return <p className="text-xs text-text-muted">Keine Saison verfügbar.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-danger">{error}</p>}

      <div>
        <Label htmlFor="goal-title" className="text-xs">
          Ziel ({selectedSeason.season})
        </Label>
        <div className="flex gap-2">
          <Input
            id="goal-title"
            placeholder="Ziel beschreiben…"
            value={newGoalTitle}
            onChange={(e) => setNewGoalTitle(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={saving || !newGoalTitle.trim()}
            onClick={() => void handleAddGoal()}
          >
            + Ziel
          </Button>
        </div>
      </div>

      {goals === null && <p className="text-xs text-text-muted">Lädt…</p>}
      {goals?.length === 0 && <p className="text-xs text-text-muted">Keine Ziele</p>}

      {goals && goals.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {goals.map((goal) => (
            <div key={goal.id} className="flex items-center justify-between gap-2 rounded border border-border bg-surface-alt p-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-text">{goal.title}</p>
                {goal.rating_stars !== null && <p className="text-xs text-text-muted">{'⭐'.repeat(goal.rating_stars)}</p>}
                {goal.notes && <p className="text-xs text-text">{goal.notes}</p>}
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditingGoal({
                    ...goal,
                    tempNotes: goal.notes || '',
                    tempRating: goal.rating_stars || 0,
                  })
                }
                className="px-2 py-1 text-text hover:text-accent"
                title="Bearbeiten"
              >
                ✏️
              </button>
            </div>
          ))}
        </div>
      )}

      {editingGoal && (
        <Modal
          title="Ziel bearbeiten"
          onClose={() => setEditingGoal(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setEditingGoal(null)}>
                Abbrechen
              </Button>
              {isAdmin && (
                <Button
                  type="button"
                  variant="danger"
                  disabled={saving}
                  onClick={() => void handleDeleteGoal(editingGoal.id)}
                >
                  Löschen
                </Button>
              )}
              <Button type="button" disabled={saving} onClick={() => void handleSaveEdit()}>
                Speichern
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="goal-title">Ziel</Label>
              <Input
                id="goal-title"
                value={editingGoal.title}
                onChange={(e) => setEditingGoal({ ...editingGoal, title: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="goal-rating">Beurteilung (Sterne)</Label>
              <select
                id="goal-rating"
                value={editingGoal.tempRating}
                onChange={(e) => setEditingGoal({ ...editingGoal, tempRating: parseInt(e.target.value, 10) })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
              >
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <option key={i} value={i}>
                    {i}★
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="goal-notes">Notizen</Label>
              <textarea
                id="goal-notes"
                value={editingGoal.tempNotes}
                onChange={(e) => setEditingGoal({ ...editingGoal, tempNotes: e.target.value })}
                placeholder="Notizen hinzufügen…"
                className="min-h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
