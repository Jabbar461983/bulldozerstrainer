import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { fetchPlayerGoalSeasons, fetchPlayerGoals, fetchPlayerNotes, deletePlayerGoal, updatePlayerGoal, deletePlayerNote } from './api';
import type { PlayerRow, PlayerNoteWithUser, PlayerGoalWithCreator } from './api';
import type { PlayerGoalSeason } from '../../types/database';
import { useAuth } from '../../auth/AuthContext';

interface PlayerDetailDialogProps {
  player: PlayerRow;
  onClose: () => void;
  onEdit: () => void;
}

interface EditingGoal extends PlayerGoalWithCreator {
  tempNotes: string;
  tempRating: number;
}

export function PlayerDetailDialog({ player, onClose, onEdit }: PlayerDetailDialogProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.is_admin ?? false;

  const [seasons, setSeasons] = useState<PlayerGoalSeason[] | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<PlayerGoalSeason | null>(null);
  const [goals, setGoals] = useState<PlayerGoalWithCreator[] | null>(null);
  const [notes, setNotes] = useState<PlayerNoteWithUser[] | null>(null);
  const [editingGoal, setEditingGoal] = useState<EditingGoal | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSeasons() {
    try {
      const data = await fetchPlayerGoalSeasons(player.id);
      setSeasons(data);
      if (data.length > 0) {
        setSelectedSeason(data[0]);
        await loadGoals(data[0]);
      }
    } catch (err) {
      console.error('Failed to load seasons:', err);
    }
  }

  async function loadGoals(season: PlayerGoalSeason) {
    try {
      const data = await fetchPlayerGoals(season.id);
      setGoals(data);
    } catch (err) {
      console.error('Failed to load goals:', err);
    }
  }

  async function loadNotes() {
    try {
      const data = await fetchPlayerNotes(player.id);
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  }

  useEffect(() => {
    void loadSeasons();
    void loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id]);

  async function handleSaveGoal() {
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
      setEditingGoal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ziel konnte nicht gelöscht werden.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!isAdmin) return;
    const confirmed = window.confirm('Bemerkung wirklich löschen?');
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      await deletePlayerNote(noteId);
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bemerkung konnte nicht gelöscht werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal title="Spieler ansehen" onClose={onClose} footer={
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Schließen
            </Button>
            <Button type="button" onClick={onEdit}>
              Bearbeiten
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {/* Name und Team nebeneinander */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-text-muted">Name</p>
              <p className="font-semibold text-text">
                {player.first_name} {player.last_name}
              </p>
            </div>
            {player.teams.length > 0 && (
              <div className="text-right">
                <p className="text-xs text-text-muted">Team</p>
                <div className="flex flex-col gap-0.5">
                  {player.teams.map((t) => (
                    <p key={t.teamId} className="text-xs font-medium text-text">
                      {t.categoryName} · {t.teamName}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ziele */}
          {selectedSeason && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold text-text-muted">Ziele {selectedSeason.season}</p>
                {seasons && seasons.length > 1 && (
                  <select
                    value={selectedSeason.id}
                    onChange={(e) => {
                      const season = seasons.find((s) => s.id === e.target.value);
                      if (season) {
                        setSelectedSeason(season);
                        void loadGoals(season);
                      }
                    }}
                    className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-text"
                  >
                    {seasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.season}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {goals === null && <p className="text-xs text-text-muted">Lädt…</p>}
              {goals?.length === 0 && <p className="text-xs text-text-muted">Keine Ziele</p>}
              <div className="flex flex-col gap-1.5">
                {goals?.map((goal) => (
                  <div key={goal.id} className="flex items-start justify-between gap-2 rounded border border-border bg-surface-alt p-2 text-xs">
                    <div className="flex-1">
                      <p className="font-medium text-text">{goal.title}</p>
                      {goal.rating_stars !== null && <p className="mt-0.5 text-text-muted">{'⭐'.repeat(goal.rating_stars)}</p>}
                      {goal.notes && (
                        <div className="mt-1.5 border-t border-border pt-1.5">
                          <p className="text-text">{goal.notes}</p>
                          <p className="mt-0.5 text-text-muted">
                            {new Date(goal.created_at).toLocaleDateString('de-CH')} · {goal.createdByName || 'System'}
                          </p>
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingGoal({
                              ...goal,
                              tempNotes: goal.notes || '',
                              tempRating: goal.rating_stars || 0,
                            })
                          }
                          className="text-text hover:text-accent"
                          title="Bearbeiten"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteGoal(goal.id)}
                          className="text-text hover:text-danger"
                          title="Löschen"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notizen */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-text-muted">Bemerkungen</p>
            {notes === null && <p className="text-xs text-text-muted">Lädt…</p>}
            {notes?.length === 0 && <p className="text-xs text-text-muted">Keine Bemerkungen</p>}
            <div className="flex flex-col gap-1">
              {notes?.map((note) => (
                <div key={note.id} className="flex items-start justify-between gap-2 border-l-2 border-border pl-2 text-xs">
                  <div className="flex-1">
                    <p className="text-text">{note.note}</p>
                    {note.gameDate && note.gameOpponent && (
                      <p className="mt-0.5 text-text-muted">
                        Spiel: {new Date(note.gameDate).toLocaleDateString('de-CH')} vs. {note.gameOpponent}
                      </p>
                    )}
                    <p className="mt-0.5 text-text-muted">
                      {new Date(note.created_at).toLocaleDateString('de-CH')} · {note.createdByName || 'System'}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteNote(note.id)}
                      className="text-text hover:text-danger"
                      title="Löschen"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

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
              <Button type="button" disabled={saving} onClick={() => void handleSaveGoal()}>
                Speichern
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            {error && <p className="text-sm text-danger">{error}</p>}
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
    </>
  );
}
