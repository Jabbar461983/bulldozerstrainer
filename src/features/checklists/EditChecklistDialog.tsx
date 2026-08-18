import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import {
  updateChecklist,
  updateChecklistTeamAssignments,
  createChecklistItem,
  deleteChecklistItem,
} from './api';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import type { ChecklistRow } from './api';
import type { ChecklistItem } from '../../types/database';

interface EditChecklistDialogProps {
  checklist: ChecklistRow;
  onClose: () => void;
  onSaved: () => void;
}

export function EditChecklistDialog({ checklist, onClose, onSaved }: EditChecklistDialogProps) {
  const [title, setTitle] = useState(checklist.title);
  const [description, setDescription] = useState(checklist.description || '');
  const [hasReporting, setHasReporting] = useState(checklist.has_reporting);
  const [isGlobal, setIsGlobal] = useState(checklist.is_global);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set(checklist.teamIds));
  const [items, setItems] = useState<ChecklistItem[]>(checklist.items);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamOptions()
      .then((teams) => setTeamOptions(teams))
      .catch((err) => setError(err instanceof Error ? err.message : 'Teams konnten nicht geladen werden.'));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Titel ist erforderlich.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await updateChecklist(checklist.id, {
        title: title.trim(),
        description: description.trim() || null,
        has_reporting: hasReporting,
        is_global: isGlobal,
      });

      if (!isGlobal) {
        await updateChecklistTeamAssignments(checklist.id, Array.from(selectedTeamIds));
      } else {
        await updateChecklistTeamAssignments(checklist.id, []);
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Änderungen konnten nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddItem() {
    if (!newItemTitle.trim()) return;
    try {
      await createChecklistItem({
        checklist_id: checklist.id,
        title: newItemTitle.trim(),
      });
      setNewItemTitle('');
      setItems([
        ...items,
        {
          id: 'temp-' + Date.now(),
          checklist_id: checklist.id,
          title: newItemTitle.trim(),
          sort_order: items.length,
          parent_id: null,
          is_section: false,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Item konnte nicht hinzugefügt werden.');
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm('Item wirklich löschen?')) return;
    try {
      await deleteChecklistItem(itemId);
      setItems(items.filter((i) => i.id !== itemId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Item konnte nicht gelöscht werden.');
    }
  }


  async function handleDelete() {
    if (!confirm('Checkliste wirklich löschen?')) return;
    setDeleting(true);
    try {
      const { deleteChecklist } = await import('./api');
      await deleteChecklist(checklist.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
      setDeleting(false);
    }
  }

  return (
    <Modal
      title="Checkliste bearbeiten"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="text-error hover:bg-error/10"
            onClick={handleDelete}
            disabled={loading || deleting}
          >
            {deleting ? 'Löschen...' : 'Löschen'}
          </Button>
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button form="edit-checklist-form" type="submit" disabled={loading}>
            {loading ? 'Speichert...' : 'Speichern'}
          </Button>
        </div>
      }
    >
      <form id="edit-checklist-form" onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto">
        {error && <div className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</div>}

        <div>
          <Label htmlFor="edit-title">Titel *</Label>
          <Input
            id="edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titel..."
          />
        </div>

        <div>
          <Label htmlFor="edit-description">Beschreibung</Label>
          <textarea
            id="edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-muted focus:border-accent focus:outline-none"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasReporting}
              onChange={(e) => setHasReporting(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm font-medium">Mit Reporting</span>
          </label>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="edit-scope"
              checked={isGlobal}
              onChange={() => setIsGlobal(true)}
              className="rounded-full border-border"
            />
            <span className="text-sm font-medium">Global für alle Teams</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="edit-scope"
              checked={!isGlobal}
              onChange={() => setIsGlobal(false)}
              className="rounded-full border-border"
            />
            <span className="text-sm font-medium">Nur bestimmte Teams</span>
          </label>
        </div>

        {!isGlobal && (
          <div className="space-y-2">
            <Label>Teams zuordnen</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-alt p-2">
              {teamOptions.length === 0 ? (
                <p className="text-xs text-text-muted">Keine Teams verfügbar</p>
              ) : (
                teamOptions.map((team) => (
                  <label key={team.teamId} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-surface rounded">
                    <input
                      type="checkbox"
                      checked={selectedTeamIds.has(team.teamId)}
                      onChange={(e) => {
                        const newIds = new Set(selectedTeamIds);
                        if (e.target.checked) {
                          newIds.add(team.teamId);
                        } else {
                          newIds.delete(team.teamId);
                        }
                        setSelectedTeamIds(newIds);
                      }}
                      className="rounded border-border"
                    />
                    <span className="text-sm">{team.teamName}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          <Label>Punkte ({items.length})</Label>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-xs text-text-muted">Noch keine Punkte</p>
            ) : (
              items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg bg-surface-alt p-2">
                  <span className="text-xs text-text-muted">#{idx + 1}</span>
                  <span className="flex-1 text-sm">{item.title}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleDeleteItem(item.id)}
                    className="text-error"
                  >
                    ✕
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <Input
              type="text"
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              placeholder="Neuer Punkt..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAddItem();
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={handleAddItem} disabled={!newItemTitle.trim()}>
              + Hinzufügen
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
