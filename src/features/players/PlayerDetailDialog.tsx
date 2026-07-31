import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { PlayerNotes } from './PlayerNotes';
import { fetchPlayerGoalSeasons, fetchPlayerGoals } from './api';
import type { PlayerRow } from './api';
import type { PlayerGoalSeason, PlayerGoal } from '../../types/database';

interface PlayerDetailDialogProps {
  player: PlayerRow;
  currentUserId: string | null;
  onClose: () => void;
  onEdit: () => void;
}

export function PlayerDetailDialog({ player, currentUserId, onClose, onEdit }: PlayerDetailDialogProps) {
  const [seasons, setSeasons] = useState<PlayerGoalSeason[] | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<PlayerGoalSeason | null>(null);
  const [goals, setGoals] = useState<PlayerGoal[] | null>(null);

  async function loadSeasons() {
    try {
      const data = await fetchPlayerGoalSeasons(player.id);
      setSeasons(data);
      if (data.length > 0) {
        setSelectedSeason(data[0]);
        loadGoals(data[0]);
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

  useEffect(() => {
    void loadSeasons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id]);

  return (
    <Modal
      title={`${player.first_name} ${player.last_name} ansehen`}
      onClose={onClose}
      footer={
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
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border p-3">
          <p className="text-sm text-text-muted">Name</p>
          <p className="font-medium text-text">
            {player.first_name} {player.last_name}
          </p>
        </div>

        {player.teams.length > 0 && (
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm text-text-muted">Team</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {player.teams.map((t) => (
                <span key={t.teamId} className="rounded-full bg-surface-alt px-2.5 py-1 text-xs text-text-muted">
                  {t.categoryName} · {t.teamName}
                </span>
              ))}
            </div>
          </div>
        )}

        {selectedSeason && (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-sm text-text-muted">Ziele ({selectedSeason.season})</p>
            {goals === null && <p className="text-sm text-text-muted">Lädt…</p>}
            {goals?.length === 0 && <p className="text-sm text-text-muted">Keine Ziele für diese Saison.</p>}
            <div className="flex flex-col gap-2">
              {goals?.map((goal) => (
                <div key={goal.id} className="rounded-lg bg-surface p-2">
                  <p className="font-medium text-text">{goal.title}</p>
                  <p className="text-sm text-text-muted">{'⭐'.repeat(goal.rating_stars ?? 0)}</p>
                  {goal.notes && <p className="mt-1 text-sm text-text">{goal.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {seasons && seasons.length > 1 && (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-sm text-text-muted">Frühere Saisons</p>
            <select
              value={selectedSeason?.id ?? ''}
              onChange={(e) => {
                const season = seasons.find((s) => s.id === e.target.value);
                if (season) {
                  setSelectedSeason(season);
                  void loadGoals(season);
                }
              }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.season}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-sm text-text-muted">Notizen</p>
          <PlayerNotes playerId={player.id} currentUserId={currentUserId} />
        </div>
      </div>
    </Modal>
  );
}
