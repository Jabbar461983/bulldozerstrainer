import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { fetchChecklistInstances, toggleChecklistItem, saveChecklistCompletion, createChecklistInstance } from './api';
import type { ChecklistRow, ChecklistInstanceRow } from './api';

interface ChecklistInstanceWorkspaceProps {
  checklist: ChecklistRow;
  teamId: string;
  onClose: () => void;
}

export function ChecklistInstanceWorkspace({
  checklist,
  teamId,
  onClose,
}: ChecklistInstanceWorkspaceProps) {
  const [selectedInstance, setSelectedInstance] = useState<ChecklistInstanceRow | null>(null);
  const [globalNote, setGlobalNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchChecklistInstances(checklist.id);
        const filtered = data.filter((i) => !i.team_id || i.team_id === teamId);
        if (filtered.length > 0) {
          setSelectedInstance(filtered[0]);
          setGlobalNote(filtered[0].notes || '');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      }
    }
    void load();
  }, [checklist.id, teamId]);

  async function handleToggleItem(itemId: string) {
    if (!selectedInstance) return;
    setLoading(true);
    try {
      await toggleChecklistItem({
        instance_id: selectedInstance.id,
        item_id: itemId,
      });

      const completion = selectedInstance.completions[itemId];
      setSelectedInstance({
        ...selectedInstance,
        completions: {
          ...selectedInstance.completions,
          [itemId]: completion
            ? undefined
            : {
                id: `temp-${Date.now()}`,
                checklist_instance_id: selectedInstance.id,
                checklist_item_id: itemId,
                user_id: 'current',
                notes: null,
                completed_at: new Date().toISOString(),
              },
        },
        progress: {
          total: selectedInstance.progress.total,
          completed: completion
            ? selectedInstance.progress.completed - 1
            : selectedInstance.progress.completed + 1,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!selectedInstance) return;

    const isPending = selectedInstance.progress.completed < selectedInstance.progress.total;
    if (isPending) {
      setError(`Noch ${selectedInstance.progress.total - selectedInstance.progress.completed} von ${selectedInstance.progress.total} Punkte offen`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    setLoading(true);
    try {
      await saveChecklistCompletion({
        instance_id: selectedInstance.id,
        notes: globalNote,
      });
      setMessage('Checkliste vollständig erledigt ✓');
      setTimeout(() => setMessage(null), 3000);
      setSelectedInstance({
        ...selectedInstance,
        notes: globalNote,
        completed_at: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInstance() {
    setLoading(true);
    try {
      await createChecklistInstance({
        checklist_id: checklist.id,
        team_id: teamId,
        event_date: null,
        event_context: null,
      });
      const data = await fetchChecklistInstances(checklist.id);
      const filtered = data.filter((i) => !i.team_id || i.team_id === teamId);
      if (filtered.length > 0) {
        setSelectedInstance(filtered[0]);
        setGlobalNote(filtered[0].notes || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Instanz konnte nicht erstellt werden.');
    } finally {
      setLoading(false);
    }
  }

  if (!selectedInstance) {
    return (
      <div className="space-y-4">
        <Button onClick={onClose} variant="secondary">
          ← Zurück
        </Button>
        <Card className="text-center space-y-4">
          <p className="text-text-muted">Noch keine Instanz dieser Checkliste erstellt</p>
          <Button onClick={handleCreateInstance} disabled={loading}>
            {loading ? 'Erstelle...' : '+ Neue Instanz erstellen'}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Button onClick={onClose} variant="secondary">
            ← Zurück
          </Button>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-center">{selectedInstance.checklistTitle}</h1>
          {selectedInstance.teamName && (
            <p className="text-sm text-text-muted text-center">{selectedInstance.teamName}</p>
          )}
          {selectedInstance.event_date && (
            <p className="text-xs text-text-muted text-center">{selectedInstance.event_date}</p>
          )}
          {selectedInstance.event_context && (
            <p className="text-xs text-text-muted text-center">{selectedInstance.event_context}</p>
          )}
        </div>
        <div />
      </div>

      {error && (
        <div className="rounded-lg bg-error/10 p-4 text-error text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg bg-accent/10 p-4 text-accent text-sm font-medium">
          {message}
        </div>
      )}

      <Card className="bg-surface-alt">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Fortschritt</span>
            <span className="text-lg font-bold text-accent">
              {selectedInstance.progress.completed} von {selectedInstance.progress.total}
            </span>
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full transition-all"
              style={{
                width: `${(selectedInstance.progress.completed / selectedInstance.progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      </Card>

      <div className="space-y-2 max-h-[calc(100vh-500px)] overflow-y-auto">
        {selectedInstance.items.map((item) => {
          const isCompleted = !!selectedInstance.completions[item.id];
          const indent = item.parent_id ? 'ml-6' : 'ml-0';
          return (
            <Card key={item.id} className={`space-y-2 ${indent}`}>
              <label className="flex items-center gap-3 cursor-pointer p-0 hover:bg-surface-alt rounded transition">
                <input
                  type="checkbox"
                  checked={isCompleted}
                  onChange={() => void handleToggleItem(item.id)}
                  disabled={loading}
                  className="rounded border-border w-5 h-5"
                />
                <span className={`flex-1 font-medium ${isCompleted ? 'line-through text-text-muted' : 'text-text'}`}>
                  {item.title}
                </span>
              </label>
            </Card>
          );
        })}
      </div>

      {selectedInstance.progress.completed === selectedInstance.progress.total && (
        <Card className="bg-surface-alt space-y-2">
          <label className="block text-sm font-semibold text-text">Abschließende Notiz</label>
          <textarea
            value={globalNote}
            onChange={(e) => setGlobalNote(e.target.value)}
            placeholder="Notiz zum Abschluss der Checkliste..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-muted focus:border-accent focus:outline-none resize-none"
            rows={3}
            disabled={loading}
          />
        </Card>
      )}

      <Button
        onClick={handleSave}
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Speichert...' : 'Speichern'}
      </Button>
    </div>
  );
}
