import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { Input } from '../../components/Input';
import { fetchTeamPlayerRoster, fetchGameLineup, replaceGameLineup, LINEUP_POSITIONS } from './api';
import type { RosterPlayer } from './api';
import type { GameLineupPosition } from '../../types/database';

interface LineupRowState {
  block: string;
  position: GameLineupPosition | '';
}

interface GameLineupEditorProps {
  gameId: string;
  teamId: string;
}

export function GameLineupEditor({ gameId, teamId }: GameLineupEditorProps) {
  const [roster, setRoster] = useState<RosterPlayer[] | null>(null);
  const [state, setState] = useState<Record<string, LineupRowState>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [rosterRows, lineup] = await Promise.all([fetchTeamPlayerRoster(teamId), fetchGameLineup(gameId)]);
      setRoster(rosterRows);
      const lineupByPlayer = new Map(lineup.map((l) => [l.player_id, l]));
      const next: Record<string, LineupRowState> = {};
      for (const player of rosterRows) {
        const entry = lineupByPlayer.get(player.playerId);
        next[player.playerId] = {
          block: entry?.block_number != null ? String(entry.block_number) : '',
          position: entry?.position ?? '',
        };
      }
      setState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aufstellung konnte nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, teamId]);

  function updateRow(playerId: string, patch: Partial<LineupRowState>) {
    setState((prev) => ({ ...prev, [playerId]: { ...prev[playerId], ...patch } }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const entries = Object.entries(state)
        .filter(([, row]) => row.position !== '')
        .map(([playerId, row]) => ({
          player_id: playerId,
          position: row.position as GameLineupPosition,
          block_number: row.block ? Number(row.block) : null,
        }));
      await replaceGameLineup(gameId, entries);
      setNotice('Aufstellung gespeichert.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aufstellung konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  if (roster === null) return <p className="text-sm text-text-muted">Lädt…</p>;
  if (roster.length === 0) {
    return <p className="text-sm text-text-muted">Diesem Team sind noch keine Spieler zugewiesen.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {roster.map((player) => {
        const row = state[player.playerId] ?? { block: '', position: '' };
        return (
          <div key={player.playerId} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2 text-sm">
            <span className="flex-1 font-medium text-text">
              {player.firstName} {player.lastName}
            </span>
            <Select
              value={row.position}
              onChange={(e) => updateRow(player.playerId, { position: e.target.value as GameLineupPosition | '' })}
              className="w-40"
            >
              <option value="">Nicht aufgestellt</option>
              {LINEUP_POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={1}
              placeholder="Block"
              value={row.block}
              disabled={row.position === ''}
              onChange={(e) => updateRow(player.playerId, { block: e.target.value })}
              className="w-20"
            />
          </div>
        );
      })}

      <Button type="button" disabled={saving} onClick={() => void handleSave()} className="self-start">
        {saving ? 'Speichern…' : 'Aufstellung speichern'}
      </Button>
      {notice && <p className="text-sm text-success">{notice}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
