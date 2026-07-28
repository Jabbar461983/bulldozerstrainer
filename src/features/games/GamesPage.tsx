import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Select } from '../../components/Select';
import { OfflineNotice } from '../../components/OfflineNotice';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import { todayIso } from '../../lib/dates';
import { withCache } from '../../lib/withCache';
import { fetchGames } from './api';
import type { Game } from '../../types/database';
import { CreateGameDialog } from './CreateGameDialog';
import { ImportGamesDialog } from './ImportGamesDialog';
import { GameDetailDialog } from './GameDetailDialog';

export function GamesPage() {
  const [teamOptions, setTeamOptions] = useState<TeamOption[] | null>(null);
  const [teamId, setTeamId] = useState('');
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineCachedAt, setOfflineCachedAt] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  useEffect(() => {
    withCache('team-options', fetchTeamOptions)
      .then((result) => {
        setTeamOptions(result.data);
        if (result.data.length > 0) setTeamId(result.data[0].teamId);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Teams konnten nicht geladen werden.'));
  }, []);

  const selectedTeam = teamOptions?.find((t) => t.teamId === teamId) ?? null;

  async function load(currentTeamId: string) {
    if (!currentTeamId) return;
    setError(null);
    try {
      const result = await withCache(`games:${currentTeamId}`, () => fetchGames(currentTeamId));
      setGames(result.data);
      setOfflineCachedAt(result.fromCache ? result.cachedAt : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spiele konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    if (teamId) void load(teamId);
  }, [teamId]);

  const { upcoming, past } = useMemo(() => {
    const today = todayIso();
    const upcoming = (games ?? []).filter((g) => g.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const past = (games ?? []).filter((g) => g.date < today);
    return { upcoming, past };
  }, [games]);

  function renderGame(game: Game) {
    const hasResult = game.result_us != null && game.result_them != null;
    return (
      <Card
        key={game.id}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedGame(game)}
        onKeyDown={(e) => e.key === 'Enter' && setSelectedGame(game)}
        className="cursor-pointer"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium text-text">
              {game.home_team} – {game.away_team}
            </p>
            <p className="text-sm text-text-muted">
              {new Date(`${game.date}T00:00:00`).toLocaleDateString('de-CH', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
              {game.time && ` · ${game.time.slice(0, 5)}`}
              {game.location && ` · ${game.location}`}
            </p>
          </div>
          {hasResult && (
            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-sm font-medium text-accent">
              {game.result_us}:{game.result_them}
            </span>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">Spiele</h1>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={!teamId} onClick={() => setShowImport(true)}>
            CSV-Import
          </Button>
          <Button disabled={!teamId} onClick={() => setShowCreate(true)}>
            + Neues Spiel
          </Button>
        </div>
      </div>

      {teamOptions !== null && teamOptions.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">
            Dir ist noch kein Team zugewiesen. Bitte wende dich an einen Admin.
          </p>
        </Card>
      )}

      {teamOptions && teamOptions.length > 0 && (
        <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {teamOptions.map((t) => (
            <option key={t.teamId} value={t.teamId}>
              {t.categoryName} · {t.teamName} ({t.season})
            </option>
          ))}
        </Select>
      )}

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {offlineCachedAt && <OfflineNotice cachedAt={offlineCachedAt} />}

      {games === null && teamId && <p className="text-sm text-text-muted">Lädt…</p>}

      {games !== null && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text-muted">Kommende Spiele</h2>
            {upcoming.length === 0 && (
              <Card>
                <p className="text-sm text-text-muted">Keine kommenden Spiele geplant.</p>
              </Card>
            )}
            <div className="flex flex-col gap-2">{upcoming.map(renderGame)}</div>
          </div>

          {past.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-text-muted">Vergangene Spiele</h2>
              <div className="flex flex-col gap-2">{past.map(renderGame)}</div>
            </div>
          )}
        </div>
      )}

      {showCreate && selectedTeam && (
        <CreateGameDialog
          teamId={selectedTeam.teamId}
          categoryId={selectedTeam.categoryId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load(teamId);
          }}
        />
      )}

      {showImport && selectedTeam && (
        <ImportGamesDialog
          teamId={selectedTeam.teamId}
          categoryId={selectedTeam.categoryId}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            void load(teamId);
          }}
        />
      )}

      {selectedGame && (
        <GameDetailDialog
          game={selectedGame}
          teamId={teamId}
          onClose={() => setSelectedGame(null)}
          onSaved={() => {
            setSelectedGame(null);
            void load(teamId);
          }}
          onDeleted={() => {
            setSelectedGame(null);
            void load(teamId);
          }}
        />
      )}
    </div>
  );
}
