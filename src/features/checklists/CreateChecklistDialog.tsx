import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { createChecklist, updateChecklistTeamAssignments, createChecklistItem } from './api';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import type { ChecklistItem } from '../../types/database';
import { ChecklistItemEditor } from './ChecklistItemEditor';

interface CreateChecklistDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateChecklistDialog({ onClose, onCreated }: CreateChecklistDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hasReporting, setHasReporting] = useState(false);
  const [isGlobal, setIsGlobal] = useState(true);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemIsSection, setNewItemIsSection] = useState(false);
  const [eventDate, setEventDate] = useState('');
  const [loading, setLoading] = useState(false);
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
      const id = await createChecklist({
        title: title.trim(),
        description: description.trim() || null,
        has_reporting: hasReporting,
        is_global: isGlobal,
      });

      if (!isGlobal && selectedTeamIds.size > 0) {
        await updateChecklistTeamAssignments(id, Array.from(selectedTeamIds));
      }

      for (const item of items) {
        await createChecklistItem({
          checklist_id: id,
          title: item.title,
          parent_id: item.parent_id,
        });
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkliste konnte nicht erstellt werden.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddItem() {
    if (!newItemTitle.trim()) return;
    setItems([
      ...items,
      {
        id: 'temp-' + Date.now(),
        checklist_id: '',
        title: newItemTitle.trim(),
        sort_order: items.length,
        parent_id: null,
        is_section: newItemIsSection,
        created_at: new Date().toISOString(),
      },
    ]);
    setNewItemTitle('');
    setNewItemIsSection(false);
  }

  function handleUpdateItem(index: number, item: ChecklistItem) {
    const updated = [...items];
    updated[index] = item;
    setItems(updated);
  }

  async function handleDeleteItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  return (
    <Modal
      title="Neue Checkliste"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button form="create-checklist-form" type="submit" disabled={loading}>
            {loading ? 'Erstelle...' : 'Erstellen'}
          </Button>
        </div>
      }
    >
      <form id="create-checklist-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</div>}

        <div>
          <Label htmlFor="title">Titel *</Label>
          <Input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z.B. Platzorganisation bei Heimspielen"
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="description">Beschreibung</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionale Beschreibung..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-muted focus:border-accent focus:outline-none"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="eventDate">Event-Datum (optional)</Label>
          <Input
            id="eventDate"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
          <p className="text-xs text-text-muted mt-1">Für fixe Termine, wenn diese Checkliste nur an diesem Datum verwendet wird</p>
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
          <p className="text-xs text-text-muted">Tracking wer wann welche Punkte abhackt</p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="scope"
              checked={isGlobal}
              onChange={() => setIsGlobal(true)}
              className="rounded-full border-border"
            />
            <span className="text-sm font-medium">Global für alle Teams</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="scope"
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
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-alt p-2">
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
          <div className="flex items-center justify-between">
            <Label>Punkte ({items.length})</Label>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-xs text-text-muted">Noch keine Punkte</p>
            ) : (
              items.map((item, idx) => (
                <ChecklistItemEditor
                  key={item.id}
                  item={item}
                  index={idx}
                  onUpdate={(updated) => handleUpdateItem(idx, updated)}
                  onDelete={handleDeleteItem}
                />
              ))
            )}
          </div>

          <div className="space-y-2 rounded-lg bg-surface-alt p-3">
            <div className="flex gap-2">
              <Input
                type="text"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder={newItemIsSection ? 'Überschrift...' : 'Neuer Punkt...'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAddItem();
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={handleAddItem} disabled={!newItemTitle.trim()}>
                + {newItemIsSection ? 'Überschrift' : 'Punkt'}
              </Button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newItemIsSection}
                onChange={(e) => setNewItemIsSection(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Als Überschrift</span>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
