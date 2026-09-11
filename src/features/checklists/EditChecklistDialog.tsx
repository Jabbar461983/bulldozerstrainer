import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import {
  updateChecklist,
  updateChecklistTeamAssignments,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  reorderChecklistItems,
} from './api';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import type { ChecklistRow } from './api';
import type { ChecklistItem } from '../../types/database';
import { buildChecklistItemTree, siblingsOf, nextSortOrder } from './itemTree';

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
  const [newItemType, setNewItemType] = useState<'heading' | 'subheading' | 'step'>('step');
  const [newItemParentId, setNewItemParentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'items'>('details');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const itemTree = buildChecklistItemTree(items);

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Blendet alle Nachkommen eingeklappter Überschriften aus. itemTree ist per
  // Tiefensuche geordnet - Nachkommen eines Knotens stehen also lückenlos
  // direkt danach, mit grösserer depth, bis wieder eine depth <= der des
  // eingeklappten Knotens folgt.
  const visibleItemTree: typeof itemTree = [];
  let skipUntilDepth: number | null = null;
  for (const node of itemTree) {
    if (skipUntilDepth !== null) {
      if (node.depth > skipUntilDepth) continue;
      skipUntilDepth = null;
    }
    visibleItemTree.push(node);
    if (node.item.is_section && collapsedIds.has(node.item.id)) {
      skipUntilDepth = node.depth;
    }
  }

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
      const isSection = newItemType !== 'step';
      const sortOrder = nextSortOrder(items, newItemParentId);
      const itemId = await createChecklistItem({
        checklist_id: checklist.id,
        title: newItemTitle.trim(),
        parent_id: newItemParentId,
        is_section: isSection,
        sort_order: sortOrder,
      });
      setNewItemTitle('');
      setNewItemType('step');
      setNewItemParentId(null);
      setItems([
        ...items,
        {
          id: itemId,
          checklist_id: checklist.id,
          title: newItemTitle.trim(),
          sort_order: sortOrder,
          parent_id: newItemParentId,
          is_section: isSection,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Item konnte nicht hinzugefügt werden.');
    }
  }

  // Reihenfolge wird ausschliesslich innerhalb der Geschwistergruppe (gleicher
  // parent_id) verändert - Überschrift, Subüberschrift und Schritt bleiben
  // dabei immer an ihrem Platz in der Hierarchie.
  async function moveItem(itemId: string, direction: 'up' | 'down') {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const siblings = siblingsOf(items, item.parent_id);
    const idx = siblings.findIndex((s) => s.id === itemId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const other = siblings[swapIdx];
    try {
      await reorderChecklistItems(checklist.id, [
        { id: item.id, sort_order: other.sort_order },
        { id: other.id, sort_order: item.sort_order },
      ]);
      setItems((prev) =>
        prev.map((i) => {
          if (i.id === item.id) return { ...i, sort_order: other.sort_order };
          if (i.id === other.id) return { ...i, sort_order: item.sort_order };
          return i;
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reihenfolge konnte nicht geändert werden.');
    }
  }

  async function persistReorder(orderedSiblings: ChecklistItem[], reparent?: { id: string; parentId: string | null }) {
    const updates = orderedSiblings.map((s, idx) => ({ id: s.id, sort_order: idx }));
    try {
      if (reparent) await updateChecklistItem(reparent.id, { parent_id: reparent.parentId });
      await reorderChecklistItems(checklist.id, updates);
      setItems((prev) =>
        prev.map((i) => {
          const update = updates.find((u) => u.id === i.id);
          if (reparent && i.id === reparent.id) {
            return { ...i, parent_id: reparent.parentId, sort_order: update?.sort_order ?? i.sort_order };
          }
          return update ? { ...i, sort_order: update.sort_order } : i;
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reihenfolge konnte nicht geändert werden.');
    }
  }

  async function handleDropItem(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const dragged = items.find((i) => i.id === draggedId);
    const target = items.find((i) => i.id === targetId);
    if (!dragged || !target) return;

    if (dragged.is_section) {
      // Überschriften/Subüberschriften: wie bisher nur innerhalb derselben
      // Geschwistergruppe umsortieren, kein Verschieben auf eine andere Ebene.
      if (dragged.parent_id !== target.parent_id) return;
      const siblings = siblingsOf(items, dragged.parent_id).filter((s) => s.id !== draggedId);
      const targetIdx = siblings.findIndex((s) => s.id === targetId);
      siblings.splice(targetIdx, 0, dragged);
      await persistReorder(siblings);
      return;
    }

    // Schritte können auch unter einer anderen Überschrift/Subüberschrift
    // abgelegt werden: direkt auf die Überschrift gezogen wird der Schritt ans
    // Ende ihrer Kinder angehängt, auf einen ihrer bestehenden Schritte
    // gezogen wird er direkt davor eingefügt.
    const newParentId = target.is_section ? target.id : target.parent_id;
    const newSiblings = siblingsOf(items, newParentId).filter((s) => s.id !== draggedId);
    if (target.is_section) {
      newSiblings.push(dragged);
    } else {
      const targetIdx = newSiblings.findIndex((s) => s.id === targetId);
      newSiblings.splice(targetIdx, 0, dragged);
    }
    await persistReorder(newSiblings, newParentId !== dragged.parent_id ? { id: draggedId, parentId: newParentId } : undefined);
  }

  function startEditItem(item: ChecklistItem) {
    setEditingItemId(item.id);
    setEditingTitle(item.title);
  }

  async function saveEditItem() {
    const id = editingItemId;
    const trimmed = editingTitle.trim();
    setEditingItemId(null);
    if (!id || !trimmed) return;
    try {
      await updateChecklistItem(id, { title: trimmed });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, title: trimmed } : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Titel konnte nicht gespeichert werden.');
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
      fullscreen
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
      <form id="edit-checklist-form" onSubmit={handleSubmit} className="flex h-full flex-col space-y-4">
        {error && <div className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</div>}

        <div className="flex gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              activeTab === 'details' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              activeTab === 'items' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            Punkte ({items.length})
          </button>
        </div>

        <div className={activeTab === 'details' ? 'space-y-4' : 'hidden'}>
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

        </div>

        <div className={activeTab === 'items' ? 'space-y-3' : 'hidden'}>
          <Label>Punkte ({items.length})</Label>
          <div className="space-y-1.5 max-h-[45vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-xs text-text-muted">Noch keine Punkte</p>
            ) : (
              visibleItemTree.map(({ item, depth }) => {
                const typeLabel = item.is_section ? (depth === 0 ? '📌 Überschrift' : '📋 Subüberschrift') : '✓ Schritt';
                const siblings = siblingsOf(items, item.parent_id);
                const siblingIdx = siblings.findIndex((s) => s.id === item.id);
                const hasChildren = item.is_section && items.some((i) => i.parent_id === item.id);
                const isCollapsed = collapsedIds.has(item.id);
                const isEditing = editingItemId === item.id;
                return (
                  <div
                    key={item.id}
                    draggable={!isEditing}
                    onDragStart={() => setDragItemId(item.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragItemId) void handleDropItem(dragItemId, item.id);
                      setDragItemId(null);
                    }}
                    onDragEnd={() => setDragItemId(null)}
                    className="rounded-lg bg-surface-alt p-2 space-y-2"
                    style={{ marginLeft: depth * 20, cursor: isEditing ? 'default' : 'grab' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted select-none" aria-hidden="true">⠿</span>
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleCollapsed(item.id)}
                          className="text-text-muted"
                          aria-label={isCollapsed ? 'Aufklappen' : 'Zuklappen'}
                          title={isCollapsed ? 'Aufklappen' : 'Zuklappen'}
                        >
                          {isCollapsed ? '▸' : '▾'}
                        </button>
                      ) : (
                        <span className="w-3" />
                      )}
                      <span className="text-xs text-text-muted whitespace-nowrap">{typeLabel}</span>
                      {isEditing ? (
                        <Input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => void saveEditItem()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void saveEditItem();
                            } else if (e.key === 'Escape') {
                              setEditingItemId(null);
                            }
                          }}
                          className="flex-1"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditItem(item)}
                          className="flex-1 text-left text-sm font-medium hover:underline"
                          title="Titel bearbeiten"
                        >
                          {item.title}
                        </button>
                      )}
                      <div className="flex gap-1">
                        {siblingIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => void moveItem(item.id, 'up')}
                            className="text-xs px-2 py-1 bg-surface hover:bg-surface-alt rounded"
                            title="Nach oben"
                          >
                            ↑
                          </button>
                        )}
                        {siblingIdx < siblings.length - 1 && (
                          <button
                            type="button"
                            onClick={() => void moveItem(item.id, 'down')}
                            className="text-xs px-2 py-1 bg-surface hover:bg-surface-alt rounded"
                            title="Nach unten"
                          >
                            ↓
                          </button>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-error"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <p className="text-xs text-text-muted">Punkte ziehen (⠿), um die Reihenfolge innerhalb derselben Ebene zu ändern.</p>

          <div className="space-y-2 border-t border-border pt-3">
            <Label>Neuer Punkt</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={newItemType}
                  onChange={(e) => {
                    setNewItemType(e.target.value as 'heading' | 'subheading' | 'step');
                    setNewItemParentId(null);
                  }}
                  className="px-3 py-2 rounded-lg border border-border bg-surface text-sm"
                >
                  <option value="heading">Überschrift</option>
                  <option value="subheading">Subüberschrift</option>
                  <option value="step">Schritt</option>
                </select>
              </div>
              {newItemType === 'subheading' && (
                <div>
                  <Label className="text-xs">Unter Überschrift:</Label>
                  <select
                    value={newItemParentId || ''}
                    onChange={(e) => setNewItemParentId(e.target.value || null)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm"
                  >
                    <option value="">-- Wähle Überschrift --</option>
                    {items.filter((i) => i.is_section && !i.parent_id).map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {newItemType === 'step' && (
                <div>
                  <Label className="text-xs">Unter Überschrift/Subüberschrift (optional):</Label>
                  <select
                    value={newItemParentId || ''}
                    onChange={(e) => setNewItemParentId(e.target.value || null)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm"
                  >
                    <option value="">-- Oberste Ebene (keine Überschrift) --</option>
                    {itemTree
                      .filter(({ item }) => item.is_section)
                      .map(({ item, depth }) => (
                        <option key={item.id} value={item.id}>
                          {'  '.repeat(depth)}
                          {item.title}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  placeholder="Titel eingeben..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleAddItem();
                    }
                  }}
                />
                <Button type="button" onClick={handleAddItem} disabled={!newItemTitle.trim()}>
                  + Hinzufügen
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
