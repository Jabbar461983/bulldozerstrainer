import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { createChecklist, updateChecklistTeamAssignments, createChecklistInstancesForHomeGames, createChecklistItem } from './api';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';

interface ChecklistItemInput {
  title: string;
  isHeading: boolean;
  parentId?: string;
}

interface CreateChecklistDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateChecklistDialog({ onClose, onCreated }: CreateChecklistDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hasReporting, setHasReporting] = useState(false);
  const [isGlobal, setIsGlobal] = useState(true);
  const [autoCreateForHomeGames, setAutoCreateForHomeGames] = useState(false);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ChecklistItemInput[]>([]);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [isHeadingMode, setIsHeadingMode] = useState(true);
  const [expandedHeadingIdx, setExpandedHeadingIdx] = useState<number | null>(null);

  useEffect(() => {
    fetchTeamOptions()
      .then((teams) => setTeamOptions(teams))
      .catch((err) => setError(err instanceof Error ? err.message : 'Teams konnten nicht geladen werden.'));
  }, []);

  function handleAddItem() {
    if (!newItemTitle.trim()) return;

    if (isHeadingMode) {
      setItems([...items, { title: newItemTitle.trim(), isHeading: true }]);
      setNewItemTitle('');
    } else if (expandedHeadingIdx !== null) {
      const headingItem = items[expandedHeadingIdx];
      const newItems = [...items];
      newItems.splice(expandedHeadingIdx + 1, 0, {
        title: newItemTitle.trim(),
        isHeading: false,
        parentId: headingItem.title,
      });
      setItems(newItems);
      setNewItemTitle('');
    }
  }

  function handleDeleteItem(idx: number) {
    const newItems = items.filter((_, i) => i !== idx);
    setItems(newItems);
  }

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
        auto_create_for_home_games: autoCreateForHomeGames,
      });

      if (!isGlobal && selectedTeamIds.size > 0) {
        await updateChecklistTeamAssignments(id, Array.from(selectedTeamIds));
      }

      // Create items
      const headingMap = new Map<string, string>();
      for (const item of items) {
        if (item.isHeading) {
          const itemId = await createChecklistItem({
            checklist_id: id,
            title: item.title,
            parent_id: null,
          });
          headingMap.set(item.title, itemId);
        }
      }

      for (const item of items) {
        if (!item.isHeading && item.parentId) {
          const parentId = headingMap.get(item.parentId);
          if (parentId) {
            await createChecklistItem({
              checklist_id: id,
              title: item.title,
              parent_id: parentId,
            });
          }
        }
      }

      // If auto-create is enabled, create instances for existing home games
      if (autoCreateForHomeGames && selectedTeamIds.size > 0) {
        await createChecklistInstancesForHomeGames(id, Array.from(selectedTeamIds));
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkliste konnte nicht erstellt werden.');
    } finally {
      setLoading(false);
    }
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
              type="checkbox"
              checked={autoCreateForHomeGames}
              onChange={(e) => setAutoCreateForHomeGames(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm font-medium">Automatisch für Heimspiele erstellen</span>
          </label>
          <p className="text-xs text-text-muted">Erstellt automatisch eine Checkliste-Instanz für jedes Heimspiel der zugewiesenen Teams. Das Datum wird automatisch auf das Spieldatum gesetzt.</p>
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
          <Label>Punkte ({items.length})</Label>

          {items.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className={`rounded-lg p-2 ${item.isHeading ? 'bg-accent/10 font-semibold' : 'bg-surface-alt ml-4'}`}>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm">{item.isHeading ? '📌 ' : '✓ '}{item.title}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleDeleteItem(idx)}
                      className="text-error text-xs"
                      disabled={loading}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="radio"
                  checked={isHeadingMode}
                  onChange={() => setIsHeadingMode(true)}
                  className="rounded-full border-border"
                  disabled={loading}
                />
                <span>Überschrift</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="radio"
                  checked={!isHeadingMode}
                  onChange={() => setIsHeadingMode(false)}
                  className="rounded-full border-border"
                  disabled={loading || items.filter((i) => i.isHeading).length === 0}
                />
                <span>Schritt</span>
              </label>
            </div>

            {!isHeadingMode && items.filter((i) => i.isHeading).length > 0 && (
              <select
                value={expandedHeadingIdx ?? ''}
                onChange={(e) => setExpandedHeadingIdx(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                disabled={loading}
              >
                <option value="">Wählen Sie eine Überschrift...</option>
                {items.map((item, idx) =>
                  item.isHeading ? (
                    <option key={idx} value={idx}>
                      {item.title}
                    </option>
                  ) : null
                )}
              </select>
            )}

            <div className="flex gap-2">
              <Input
                type="text"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder={isHeadingMode ? 'Neue Überschrift...' : 'Neuer Schritt...'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
                disabled={loading || (!isHeadingMode && expandedHeadingIdx === null)}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddItem}
                disabled={!newItemTitle.trim() || loading || (!isHeadingMode && expandedHeadingIdx === null)}
              >
                +
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
