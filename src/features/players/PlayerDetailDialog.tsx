import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { fetchPlayerGoalSeasons, fetchPlayerGoals, fetchPlayerNotes } from './api';
import type { PlayerRow, PlayerNoteWithUser } from './api';
import type { PlayerGoalSeason, PlayerGoal } from '../../types/database';

interface PlayerDetailDialogProps {
  player: PlayerRow;
  currentUserId?: string | null;
  onClose: () => void;
  onEdit: () => void;
}

export function PlayerDetailDialog({ player, onClose, onEdit }: PlayerDetailDialogProps) {
  const [seasons, setSeasons] = useState<PlayerGoalSeason[] | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<PlayerGoalSeason | null>(null);
  const [goals, setGoals] = useState<PlayerGoal[] | null>(null);
  const [notes, setNotes] = useState<PlayerNoteWithUser[] | null>(null);

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

  return (
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
            <div className="flex flex-col gap-1">
              {goals?.map((goal) => (
                <div key={goal.id} className="rounded border border-border bg-surface-alt p-1.5 text-xs">
                  <p className="text-text">{goal.title}</p>
                  <p className="text-text-muted">{'⭐'.repeat(goal.rating_stars ?? 0)}</p>
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
              <div key={note.id} className="border-l-2 border-border pl-2 text-xs">
                <p className="text-text">{note.note}</p>
                <p className="mt-0.5 text-text-muted">
                  {new Date(note.created_at).toLocaleDateString('de-CH')} · {note.createdByName || 'System'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
