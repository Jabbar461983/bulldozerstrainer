import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { OfflineNotice } from '../../components/OfflineNotice';
import { withCache } from '../../lib/withCache';
import { fetchChecklists, deleteChecklist } from './api';
import type { ChecklistRow } from './api';
import { CreateChecklistDialog } from './CreateChecklistDialog';
import { EditChecklistDialog } from './EditChecklistDialog';

export function ChecklistsAdminPage() {
  const [checklists, setChecklists] = useState<ChecklistRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineCachedAt, setOfflineCachedAt] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<ChecklistRow | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  async function load() {
    setError(null);
    try {
      const result = await withCache('checklists', fetchChecklists);
      setChecklists(result.data);
      setOfflineCachedAt(result.fromCache ? result.cachedAt : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checklisten konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Checkliste wirklich löschen?')) return;
    try {
      await deleteChecklist(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Checklisten-Verwaltung</h1>
        <Button onClick={() => setShowCreate(true)}>+ Neue Checkliste</Button>
      </div>

      {offlineCachedAt && <OfflineNotice cachedAt={offlineCachedAt} />}

      {error && (
        <div className="rounded-lg bg-error/10 p-4 text-error">
          {error}
        </div>
      )}

      {checklists === null ? (
        <div className="flex justify-center py-8 text-text-muted">Lädt...</div>
      ) : checklists.length === 0 ? (
        <Card>
          <p className="text-center text-text-muted">Noch keine Checklisten erstellt.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {checklists.map((checklist) => (
            <Card
              key={checklist.id}
              className="cursor-pointer hover:bg-surface-alt"
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedChecklist(checklist);
                setShowEdit(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSelectedChecklist(checklist);
                  setShowEdit(true);
                }
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-text">{checklist.title}</p>
                  {checklist.description && (
                    <p className="text-sm text-text-muted">{checklist.description}</p>
                  )}
                  <div className="mt-2 flex gap-4 text-xs text-text-muted">
                    <span>{checklist.items.length} Punkte</span>
                    <span>{checklist.is_global ? 'Global' : `${checklist.teamIds.length} Teams`}</span>
                    {checklist.has_reporting && <span className="font-medium text-accent">mit Reporting</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedChecklist(checklist);
                      setShowEdit(true);
                    }}
                  >
                    Bearbeiten
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(checklist.id);
                    }}
                  >
                    Löschen
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateChecklistDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}

      {showEdit && selectedChecklist && (
        <EditChecklistDialog
          checklist={selectedChecklist}
          onClose={() => {
            setShowEdit(false);
            setSelectedChecklist(null);
          }}
          onSaved={() => {
            setShowEdit(false);
            setSelectedChecklist(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
