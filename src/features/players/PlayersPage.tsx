import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { OfflineNotice } from '../../components/OfflineNotice';
import { fetchPlayers, deletePlayer, fetchPlayerGoalSeasons, fetchPlayerGoals, fetchPlayerNotes } from './api';
import type { PlayerRow } from './api';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import { withCache } from '../../lib/withCache';
import { CreatePlayerDialog } from './CreatePlayerDialog';
import { EditPlayerDialog } from './EditPlayerDialog';
import { ImportPlayersDialog } from './ImportPlayersDialog';
import { PlayerDetailDialog } from './PlayerDetailDialog';
import { useAuth } from '../../auth/AuthContext';
import type { PlayerGoal, PlayerNote } from '../../types/database';

interface PlayerWithExtras extends PlayerRow {
  currentSeasonGoals?: PlayerGoal[];
  recentNotes?: PlayerNote[];
}

export function PlayersPage() {
  const { isAdmin, memberships } = useAuth();
  const [players, setPlayers] = useState<PlayerWithExtras[] | null>(null);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [offlineCachedAt, setOfflineCachedAt] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerWithExtras | null>(null);
  const [viewingPlayer, setViewingPlayer] = useState<PlayerWithExtras | null>(null);
  const [filterName, setFilterName] = useState('');

  async function load() {
    setError(null);
    try {
      const result = await withCache('players-page', async () => {
        const [playerRows, teams] = await Promise.all([fetchPlayers(), fetchTeamOptions()]);
        return { playerRows, teams };
      });

      let filteredPlayers = result.data.playerRows;

      // Filter players based on user role
      if (!isAdmin && memberships.length > 0) {
        const userTeamIds = memberships.map((m) => m.teamId);
        filteredPlayers = filteredPlayers.filter((p) => p.teams.some((t) => userTeamIds.includes(t.teamId)));
      }

      // Load goals and notes for each player
      const playersWithExtras = await Promise.all(
        filteredPlayers.map(async (player) => {
          try {
            const seasons = await fetchPlayerGoalSeasons(player.id);
            let currentSeasonGoals: PlayerGoal[] = [];
            if (seasons.length > 0) {
              currentSeasonGoals = await fetchPlayerGoals(seasons[0].id);
            }

            const notes = await fetchPlayerNotes(player.id);
            const recentNotes = notes.slice(0, 3);

            return {
              ...player,
              currentSeasonGoals,
              recentNotes,
            };
          } catch (err) {
            console.error(`Failed to load extras for player ${player.id}:`, err);
            return player;
          }
        }),
      );

      setPlayers(playersWithExtras);
      setTeamOptions(result.data.teams);
      setOfflineCachedAt(result.fromCache ? result.cachedAt : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spieler konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, memberships]);

  async function handleDelete(player: PlayerRow) {
    const confirmed = window.confirm(`${player.first_name} ${player.last_name} wirklich unwiderruflich löschen?`);
    if (!confirmed) return;
    setBusyId(player.id);
    setError(null);
    try {
      await deletePlayer(player.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spieler konnte nicht gelöscht werden.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">Spieler</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowImport(true)}>
            CSV-Import
          </Button>
          <Button onClick={() => setShowCreate(true)}>+ Neuer Spieler</Button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {offlineCachedAt && <OfflineNotice cachedAt={offlineCachedAt} />}

      {players === null && <p className="text-sm text-text-muted">Lädt…</p>}
      {players?.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Noch keine Spieler angelegt.</p>
        </Card>
      )}

      <div className="mb-3 flex gap-2">
        <Input
          placeholder="Nach Nachname filtern…"
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="flex flex-col gap-3">
        {players
          ?.filter((p) => p.last_name.toLowerCase().includes(filterName.toLowerCase()))
          .map((player) => (
          <Card key={player.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-medium text-text">
                  {player.first_name} {player.last_name}
                </p>
                {player.birthdate && (
                  <p className="text-sm text-text-muted">
                    Geburtsdatum: {new Date(player.birthdate).toLocaleDateString('de-CH')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {player.teams.length === 0 && (
                <span className="text-xs text-text-muted">Keinem Team zugewiesen</span>
              )}
              {player.teams.map((t) => (
                <span key={t.teamId} className="rounded-full bg-surface-alt px-2.5 py-1 text-xs text-text-muted">
                  {t.categoryName} · {t.teamName}
                </span>
              ))}
            </div>

            {player.currentSeasonGoals && player.currentSeasonGoals.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-text-muted">Aktuelle Saison Ziele</p>
                <div className="flex flex-wrap gap-1">
                  {player.currentSeasonGoals.map((goal) => (
                    <span key={goal.id} className="rounded bg-surface-alt px-2 py-1 text-xs text-text">
                      {goal.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {player.recentNotes && player.recentNotes.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-text-muted">Letzte Bemerkungen</p>
                <div className="flex flex-col gap-1">
                  {player.recentNotes.map((note) => (
                    <p key={note.id} className="text-xs text-text-muted">
                      {note.note.substring(0, 50)}
                      {note.note.length > 50 ? '…' : ''}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setViewingPlayer(player)}>
                Ansehen
              </Button>
              <Button variant="secondary" onClick={() => setEditingPlayer(player)}>
                Bearbeiten
              </Button>
              <Button variant="danger" disabled={busyId === player.id} onClick={() => void handleDelete(player)}>
                Löschen
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {showCreate && (
        <CreatePlayerDialog
          teamOptions={teamOptions}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}

      {showImport && (
        <ImportPlayersDialog
          teamOptions={teamOptions}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            void load();
          }}
        />
      )}

      {viewingPlayer && (
        <PlayerDetailDialog
          player={viewingPlayer}
          onClose={() => setViewingPlayer(null)}
          onEdit={() => {
            setViewingPlayer(null);
            setEditingPlayer(viewingPlayer);
          }}
        />
      )}

      {editingPlayer && (
        <EditPlayerDialog
          player={editingPlayer}
          teamOptions={teamOptions}
          onClose={() => setEditingPlayer(null)}
          onSaved={() => {
            setEditingPlayer(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
