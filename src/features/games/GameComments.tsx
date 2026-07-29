import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { fetchTeamPlayerRoster, fetchGameComments, addGameComment } from './api';
import type { RosterPlayer, GameCommentRow } from './api';
import { useAuth } from '../../auth/AuthContext';

interface GameCommentsProps {
  gameId: string;
  teamId: string;
}

export function GameComments({ gameId, teamId }: GameCommentsProps) {
  const { profile } = useAuth();
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [comments, setComments] = useState<GameCommentRow[] | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [rosterRows, commentRows] = await Promise.all([fetchTeamPlayerRoster(teamId), fetchGameComments(gameId)]);
      setRoster(rosterRows);
      setComments(commentRows);
      if (!selectedPlayerId && rosterRows.length > 0) setSelectedPlayerId(rosterRows[0].playerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kommentare konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, teamId]);

  async function handleAdd() {
    if (!selectedPlayerId || !note.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addGameComment(gameId, selectedPlayerId, note.trim(), profile?.id ?? null);
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kommentar konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }

  if (roster.length === 0) {
    return <p className="text-sm text-text-muted">Diesem Team sind noch keine Spieler zugewiesen.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} className="min-w-0 flex-1">
          {roster.map((p) => (
            <option key={p.playerId} value={p.playerId}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex gap-2">
        <textarea
          rows={2}
          placeholder="Kommentar zu diesem Spieler…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>
      <Button type="button" variant="secondary" disabled={busy || !note.trim()} onClick={() => void handleAdd()} className="self-start">
        Hinzufügen
      </Button>
      <p className="text-xs text-text-muted">
        Kommentare erscheinen auch in den Notizen des jeweiligen Spielers.
      </p>

      {error && <p className="text-sm text-danger">{error}</p>}
      {comments === null && <p className="text-sm text-text-muted">Lädt…</p>}
      {comments?.length === 0 && <p className="text-sm text-text-muted">Noch keine Kommentare.</p>}
      <div className="flex flex-col gap-2">
        {comments?.map((c) => (
          <div key={c.id} className="rounded-xl border border-border p-2 text-sm">
            <p className="font-medium text-text">{c.playerName}</p>
            <p className="text-text-muted">{c.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
