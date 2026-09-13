import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { fetchChecklistInstances, fetchArchivedChecklistInstances, deleteChecklistInstance } from './api';
import type { ChecklistRow, ChecklistInstanceRow } from './api';

interface ChecklistInstancesManagerDialogProps {
  checklist: ChecklistRow;
  onClose: () => void;
}

export function ChecklistInstancesManagerDialog({ checklist, onClose }: ChecklistInstancesManagerDialogProps) {
  const [instances, setInstances] = useState<ChecklistInstanceRow[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setError(null);
    try {
      const [active, archived] = await Promise.all([
        fetchChecklistInstances(checklist.id),
        fetchArchivedChecklistInstances(checklist.id),
      ]);
      const all = [...active, ...archived].sort((a, b) =>
        (b.event_date ?? b.created_at).localeCompare(a.event_date ?? a.created_at),
      );
      setInstances(all);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Instanzen konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklist.id]);

  const deletableIds = (instances ?? []).filter((i) => !i.archived_at).map((i) => i.id);
  const allDeletableSelected = deletableIds.length > 0 && deletableIds.every((id) => selectedIds.has(id));

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(allDeletableSelected ? new Set() : new Set(deletableIds));
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size} Instanz(en) wirklich unwiderruflich löschen?`)) return;
    setDeleting(true);
    setError(null);
    try {
      for (const id of selectedIds) {
        await deleteChecklistInstance(id);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteSingle(id: string) {
    if (!confirm('Diese Instanz wirklich unwiderruflich löschen?')) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteChecklistInstance(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      title={`Instanzen: ${checklist.title}`}
      onClose={onClose}
      wide
      footer={
        <Button variant="secondary" onClick={onClose}>
          Schliessen
        </Button>
      }
    >
      <div className="space-y-3">
        {error && <div className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</div>}

        {instances === null ? (
          <p className="text-sm text-text-muted">Lädt…</p>
        ) : instances.length === 0 ? (
          <p className="text-sm text-text-muted">Noch keine Instanzen vorhanden.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allDeletableSelected}
                  onChange={toggleSelectAll}
                  disabled={deletableIds.length === 0}
                  className="rounded border-border"
                />
                Alle offenen auswählen
              </label>
              <Button
                variant="secondary"
                className="text-error"
                disabled={selectedIds.size === 0 || deleting}
                onClick={() => void handleDeleteSelected()}
              >
                {deleting ? 'Löscht…' : `Ausgewählte löschen (${selectedIds.size})`}
              </Button>
            </div>

            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {instances.map((instance) => {
                const isArchived = !!instance.archived_at;
                return (
                  <Card key={instance.id} className="flex flex-wrap items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(instance.id)}
                      onChange={() => toggleSelected(instance.id)}
                      disabled={isArchived}
                      className="rounded border-border"
                      title={isArchived ? 'Abgeschlossene Checklisten können nicht gelöscht werden.' : undefined}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text">
                        {instance.event_date ?? 'Kein Datum'}
                        {instance.teamName ? ` · ${instance.teamName}` : ''}
                      </p>
                      {instance.event_context && <p className="text-xs text-text-muted">{instance.event_context}</p>}
                      <p className="text-xs text-text-muted">
                        Fortschritt: {instance.progress.completed} / {instance.progress.total}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        isArchived ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'
                      }`}
                    >
                      {isArchived ? 'Abgeschlossen' : 'Offen'}
                    </span>
                    <Button
                      variant="secondary"
                      className="text-error"
                      disabled={isArchived || deleting}
                      title={isArchived ? 'Abgeschlossene Checklisten können nicht gelöscht werden.' : undefined}
                      onClick={() => void handleDeleteSingle(instance.id)}
                    >
                      Löschen
                    </Button>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
