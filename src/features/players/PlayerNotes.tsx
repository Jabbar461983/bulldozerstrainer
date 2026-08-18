import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { fetchPlayerNotes, addPlayerNote } from './api';
import type { PlayerNoteWithUser } from './api';

interface PlayerNotesProps {
  playerId: string;
  currentUserId: string | null;
}

export function PlayerNotes({ playerId, currentUserId }: PlayerNotesProps) {
  const [notes, setNotes] = useState<PlayerNoteWithUser[] | null>(null);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setNotes(await fetchPlayerNotes(playerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notizen konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  async function handleAdd() {
    if (!newNote.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addPlayerNote(playerId, newNote.trim(), currentUserId);
      setNewNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notiz konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input placeholder="Neue Notiz…" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
        <Button
          type="button"
          variant="secondary"
          disabled={saving || !newNote.trim()}
          onClick={() => void handleAdd()}
        >
          Hinzufügen
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {notes === null && <p className="text-sm text-text-muted">Lädt…</p>}
      {notes?.length === 0 && <p className="text-sm text-text-muted">Noch keine Notizen.</p>}
      <div className="flex flex-col gap-2">
        {notes?.map((note) => (
          <div key={note.id} className="rounded-xl border border-border p-2 text-sm">
            <p className="text-text">{note.note}</p>
            {note.gameDate && note.gameOpponent && (
              <p className="mt-0.5 text-xs text-text-muted">
                Spiel: {new Date(note.gameDate).toLocaleDateString('de-CH')} vs. {note.gameOpponent}
              </p>
            )}
            <p className="mt-1 text-xs text-text-muted">
              {new Date(note.created_at).toLocaleDateString('de-CH')} · {note.createdByName || 'System'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
