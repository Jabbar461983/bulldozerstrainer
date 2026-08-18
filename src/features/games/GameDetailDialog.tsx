import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { GameLineupEditor } from './GameLineupEditor';
import { GameAbsencesEditor } from './GameAbsencesEditor';
import { GameRatingSection } from './GameRatingSection';
import { GameComments } from './GameComments';
import { updateGame, deleteGame, fetchPastGamesForSeason, copyGameLineups } from './api';
import type { Game } from '../../types/database';

interface GameDetailDialogProps {
  game: Game;
  teamId: string;
  categoryName: string;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export function GameDetailDialog({ game, teamId, categoryName, onClose, onSaved, onDeleted }: GameDetailDialogProps) {
  const [date, setDate] = useState(game.date);
  const [time, setTime] = useState(game.time ?? '');
  const [location, setLocation] = useState(game.location ?? '');
  const [homeTeam, setHomeTeam] = useState(game.home_team);
  const [awayTeam, setAwayTeam] = useState(game.away_team);
  const [season, setSeason] = useState(game.season ?? '');
  const [resultUs, setResultUs] = useState(game.result_us != null ? String(game.result_us) : '');
  const [resultThem, setResultThem] = useState(game.result_them != null ? String(game.result_them) : '');
  const [preGameNotes, setPreGameNotes] = useState(game.pre_game_notes ?? '');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pastGames, setPastGames] = useState<Game[]>([]);
  const [selectedSourceGameId, setSelectedSourceGameId] = useState<string>('');
  const [copyingLineup, setCopyingLineup] = useState(false);

  useEffect(() => {
    async function loadPastGames() {
      if (!season) {
        setPastGames([]);
        return;
      }
      try {
        const games = await fetchPastGamesForSeason(teamId, season);
        setPastGames(games);
      } catch (err) {
        console.error('Failed to fetch past games:', err);
        setPastGames([]);
      }
    }
    void loadPastGames();
  }, [season, teamId]);

  async function handleCopyLineup() {
    if (!selectedSourceGameId) return;

    setCopyingLineup(true);
    setError(null);
    setMessage(null);
    try {
      await copyGameLineups(selectedSourceGameId, game.id);
      setMessage('Aufstellung kopiert ✓');
      setSelectedSourceGameId('');
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aufstellung konnte nicht kopiert werden');
      setTimeout(() => setError(null), 3000);
    } finally {
      setCopyingLineup(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateGame(game.id, {
        date,
        time: time || null,
        location: location || null,
        home_team: homeTeam,
        away_team: awayTeam,
        season: season || null,
        result_us: resultUs === '' ? null : Number(resultUs),
        result_them: resultThem === '' ? null : Number(resultThem),
        pre_game_notes: preGameNotes || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Änderungen konnten nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm('Dieses Spiel wirklich unwiderruflich löschen?');
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteGame(game.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spiel konnte nicht gelöscht werden.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      title={`${game.home_team} – ${game.away_team}`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="danger" disabled={deleting} onClick={() => void handleDelete()}>
            Löschen
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Schliessen
          </Button>
          <Button type="submit" form="edit-game-form" disabled={loading}>
            {loading ? 'Speichern…' : 'Speichern'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <form id="edit-game-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date">Datum</Label>
              <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="time">Zeit (optional)</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="homeTeam">Heimteam</Label>
              <Input id="homeTeam" required value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="awayTeam">Gastteam</Label>
              <Input id="awayTeam" required value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="location">Ort (optional)</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="season">Saison (optional)</Label>
              <Input id="season" value={season} onChange={(e) => setSeason(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Resultat</Label>
            <div className="grid grid-cols-3 gap-2 items-end">
              <div>
                <Input
                  id="resultUs"
                  type="number"
                  min={0}
                  value={resultUs}
                  onChange={(e) => setResultUs(e.target.value)}
                  placeholder="Tore"
                />
              </div>
              <div className="text-center text-xl font-bold">:</div>
              <div>
                <Input
                  id="resultThem"
                  type="number"
                  min={0}
                  value={resultThem}
                  onChange={(e) => setResultThem(e.target.value)}
                  placeholder="Tore"
                />
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="preGameNotes">Notizen vor dem Spiel (optional)</Label>
            <textarea
              id="preGameNotes"
              rows={3}
              value={preGameNotes}
              onChange={(e) => setPreGameNotes(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          {message && <p className="text-sm text-accent font-medium">{message}</p>}
        </form>

        <div className="border-t border-border pt-4">
          <Label>Aufstellung</Label>

          <div className="mb-4 space-y-2 p-3 bg-surface-alt rounded-lg">
            <p className="text-sm font-medium">Aufstellung kopieren</p>
            {!season ? (
              <p className="text-sm text-text-muted">Bitte setzen Sie die Saison, um Aufstellungen zu kopieren</p>
            ) : pastGames.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={selectedSourceGameId}
                  onChange={(e) => setSelectedSourceGameId(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm col-span-2"
                  disabled={copyingLineup}
                >
                  <option value="">Wählen Sie ein vergangenes Spiel...</option>
                  {pastGames.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.date} – {g.home_team} vs {g.away_team}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCopyLineup}
                  disabled={!selectedSourceGameId || copyingLineup}
                >
                  {copyingLineup ? 'Kopiert...' : '📋 Kopieren'}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-text-muted">Keine vergangenen Spiele dieser Saison verfügbar</p>
            )}
          </div>

          <GameLineupEditor gameId={game.id} teamId={teamId} categoryName={categoryName} />
        </div>

        <div className="border-t border-border pt-4">
          <Label>Abwesenheiten</Label>
          <GameAbsencesEditor gameId={game.id} teamId={teamId} />
        </div>

        <div className="border-t border-border pt-4">
          <Label>Bewertung</Label>
          <GameRatingSection gameId={game.id} />
        </div>

        <div className="border-t border-border pt-4">
          <Label>Spielerkommentare</Label>
          <GameComments gameId={game.id} teamId={teamId} />
        </div>
      </div>
    </Modal>
  );
}
