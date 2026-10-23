import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import type { VorstandRessort } from '../../types/database';
import { createRessort, deleteRessort, fetchRessorts, renameRessort, saveRessortOrder } from './api';

/**
 * Pflege der Vorstand-Ressorts (nur bei der Rolle Vorstand). Änderungen
 * werden sofort gespeichert, unabhängig vom Speichern-Knopf der Rolle.
 */
export function RessortsEditor() {
  const [ressorts, setRessorts] = useState<VorstandRessort[] | null>(null);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setRessorts(await fetchRessorts());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ressorts konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktion fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  function handleAdd() {
    const name = newName.trim();
    if (!name || !ressorts) return;
    const sortOrder = Math.max(0, ...ressorts.map((r) => r.sort_order)) + 1;
    void run(async () => {
      await createRessort(name, sortOrder);
      setNewName('');
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    if (!ressorts) return;
    const target = index + direction;
    if (target < 0 || target >= ressorts.length) return;
    const ids = ressorts.map((r) => r.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() => saveRessortOrder(ids));
  }

  function handleDelete(r: VorstandRessort) {
    if (!window.confirm(`Willst du das Ressort „${r.name}“ wirklich löschen?`)) return;
    void run(() => deleteRessort(r.id));
  }

  function handleRename(r: VorstandRessort) {
    const name = editingName.trim();
    setEditingId(null);
    if (!name || name === r.name) return;
    void run(() => renameRessort(r.id, name));
  }

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-border p-3">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text">
        <span className="size-2 rounded-[1px] bg-gold" />
        Ressorts
      </p>
      <p className="mb-1 text-xs text-text-muted">
        Unterrollen des Vorstands. Beim Benutzer wählst du bei der Rolle Vorstand eines dieser Ressorts. Änderungen
        hier werden sofort gespeichert. Zum Umbenennen auf den Namen tippen.
      </p>
      {ressorts === null && <p className="text-sm text-text-muted">Lädt…</p>}
      <ul className="flex flex-col divide-y divide-border">
        {ressorts?.map((r, index) => (
          <li key={r.id} className="flex items-center gap-2 py-1.5">
            {editingId === r.id ? (
              <Input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleRename(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRename(r);
                  } else if (e.key === 'Escape') {
                    setEditingId(null);
                  }
                }}
                className="min-h-9 flex-1 py-1"
              />
            ) : (
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm text-text hover:underline"
                onClick={() => {
                  setEditingId(r.id);
                  setEditingName(r.name);
                }}
              >
                {r.name}
                {r.modules?.includes('finanzen_verein') && (
                  <span className="ml-2 text-xs text-text-muted">· voller Finanzzugriff</span>
                )}
              </button>
            )}
            <Button type="button" variant="secondary" size="sm" className="px-2.5" disabled={busy || index === 0} onClick={() => handleMove(index, -1)} aria-label={`${r.name} nach oben`}>
              ↑
            </Button>
            <Button type="button" variant="secondary" size="sm" className="px-2.5" disabled={busy || index === (ressorts?.length ?? 0) - 1} onClick={() => handleMove(index, 1)} aria-label={`${r.name} nach unten`}>
              ↓
            </Button>
            <Button type="button" variant="danger" size="sm" className="px-2.5" disabled={busy} onClick={() => handleDelete(r)} aria-label={`${r.name} löschen`}>
              ✕
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <Input
          value={newName}
          placeholder="Neues Ressort, z.B. Events"
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="min-h-10 flex-1"
        />
        <Button type="button" variant="secondary" disabled={busy || !newName.trim()} onClick={handleAdd}>
          + Hinzufügen
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
