import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { fetchTeamPlayerRoster, fetchGameLineup, replaceGameLineup } from './api';
import type { RosterPlayer } from './api';
import type { GameLineupPosition } from '../../types/database';

interface LineupSlotDef {
  key: string;
  groupLabel: string;
  slotLabel: string;
  position: GameLineupPosition;
  blockNumber: number | null;
}

function buildSlots(): LineupSlotDef[] {
  const slots: LineupSlotDef[] = [
    { key: 'goalie-1', groupLabel: 'Torhüter', slotLabel: 'Torhüter', position: 'goalie', blockNumber: null },
    { key: 'goalie-2', groupLabel: 'Torhüter', slotLabel: 'Torhüter', position: 'goalie', blockNumber: null },
  ];
  for (let block = 1; block <= 4; block++) {
    slots.push(
      {
        key: `block-${block}-defense-1`,
        groupLabel: `Block ${block}`,
        slotLabel: 'Verteidigung',
        position: 'defense',
        blockNumber: block,
      },
      {
        key: `block-${block}-defense-2`,
        groupLabel: `Block ${block}`,
        slotLabel: 'Verteidigung',
        position: 'defense',
        blockNumber: block,
      },
      {
        key: `block-${block}-wing-1`,
        groupLabel: `Block ${block}`,
        slotLabel: 'Flügel',
        position: 'wing',
        blockNumber: block,
      },
      {
        key: `block-${block}-center`,
        groupLabel: `Block ${block}`,
        slotLabel: 'Center',
        position: 'center',
        blockNumber: block,
      },
      {
        key: `block-${block}-wing-2`,
        groupLabel: `Block ${block}`,
        slotLabel: 'Flügel',
        position: 'wing',
        blockNumber: block,
      },
    );
  }
  return slots;
}

const SLOTS = buildSlots();
const BLOCK_NUMBERS = [1, 2, 3, 4];

interface GameLineupEditorProps {
  gameId: string;
  teamId: string;
}

export function GameLineupEditor({ gameId, teamId }: GameLineupEditorProps) {
  const [roster, setRoster] = useState<RosterPlayer[] | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [rosterRows, lineup] = await Promise.all([fetchTeamPlayerRoster(teamId), fetchGameLineup(gameId)]);
      setRoster(rosterRows);

      // Mehrere Einträge können sich Block+Position teilen (z.B. zwei Verteidiger).
      // Ohne eigene Slot-Spalte in der DB werden sie hier der Reihe nach den
      // passenden Plätzen zugeordnet.
      const buckets = new Map<string, string[]>();
      for (const entry of lineup) {
        const bucketKey = `${entry.block_number ?? 'null'}:${entry.position}`;
        const list = buckets.get(bucketKey) ?? [];
        list.push(entry.player_id);
        buckets.set(bucketKey, list);
      }
      const consumedIndex = new Map<string, number>();
      const nextAssignments: Record<string, string> = {};
      for (const slot of SLOTS) {
        const bucketKey = `${slot.blockNumber ?? 'null'}:${slot.position}`;
        const list = buckets.get(bucketKey) ?? [];
        const idx = consumedIndex.get(bucketKey) ?? 0;
        if (idx < list.length) {
          nextAssignments[slot.key] = list[idx];
          consumedIndex.set(bucketKey, idx + 1);
        }
      }
      setAssignments(nextAssignments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aufstellung konnte nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, teamId]);

  function updateSlot(slotKey: string, playerId: string) {
    setAssignments((prev) => {
      const next = { ...prev };
      if (!playerId) {
        delete next[slotKey];
      } else {
        next[slotKey] = playerId;
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const entries = Object.entries(assignments).map(([slotKey, playerId]) => {
        const slot = SLOTS.find((s) => s.key === slotKey)!;
        return { player_id: playerId, position: slot.position, block_number: slot.blockNumber };
      });
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
  const rosterPlayers: RosterPlayer[] = roster;

  const usedElsewhere = (slotKey: string) => new Set(Object.entries(assignments).filter(([k]) => k !== slotKey).map(([, v]) => v));

  function renderSlot(slot: LineupSlotDef) {
    const currentValue = assignments[slot.key] ?? '';
    const taken = usedElsewhere(slot.key);
    return (
      <div key={slot.key} className="flex flex-col gap-1">
        <span className="text-xs text-text-muted">{slot.slotLabel}</span>
        <Select
          value={currentValue}
          onChange={(e) => updateSlot(slot.key, e.target.value)}
          className="min-w-[9rem]"
        >
          <option value="">–</option>
          {rosterPlayers
            .filter((p) => !taken.has(p.playerId) || p.playerId === currentValue)
            .map((p) => (
              <option key={p.playerId} value={p.playerId}>
                {p.lastName} {p.firstName}
              </option>
            ))}
        </Select>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-semibold text-text">Torhüter</p>
        <div className="flex flex-wrap gap-2">
          {SLOTS.filter((s) => s.groupLabel === 'Torhüter').map(renderSlot)}
        </div>
      </div>

      {BLOCK_NUMBERS.map((block) => {
        const blockSlots = SLOTS.filter((s) => s.blockNumber === block);
        const defenseSlots = blockSlots.filter((s) => s.position === 'defense');
        const forwardSlots = blockSlots.filter((s) => s.position !== 'defense');
        return (
          <div key={block}>
            <p className="mb-2 text-sm font-semibold text-text">Block {block}</p>
            <div className="flex flex-wrap gap-2">{defenseSlots.map(renderSlot)}</div>
            <div className="mt-2 flex flex-wrap gap-2">{forwardSlots.map(renderSlot)}</div>
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
