import { useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import type { ChecklistItem } from '../../types/database';

interface ChecklistItemEditorProps {
  item: ChecklistItem;
  index: number;
  onUpdate: (item: ChecklistItem) => void;
  onDelete: (index: number) => void;
}

export function ChecklistItemEditor({ item, index, onUpdate, onDelete }: ChecklistItemEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [isSection, setIsSection] = useState(item.is_section);

  function handleSave() {
    onUpdate({
      ...item,
      title: editTitle,
      is_section: isSection,
    });
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="space-y-2 rounded-lg bg-surface-alt p-3">
        <div className="flex gap-2">
          <Input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Titel..."
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleSave}
          >
            ✓
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsEditing(false)}
          >
            ✕
          </Button>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isSection}
            onChange={(e) => setIsSection(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm">Als Überschrift</span>
        </label>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-lg p-3 ${
        isSection ? 'bg-accent/20 font-semibold' : 'bg-surface-alt'
      }`}
    >
      <span className="text-xs text-text-muted min-w-6">#{index + 1}</span>
      <span
        className="flex-1 cursor-pointer hover:underline"
        onClick={() => setIsEditing(true)}
      >
        {editTitle}
      </span>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setEditTitle(item.title);
          setIsSection(item.is_section);
          setIsEditing(true);
        }}
        className="text-sm"
      >
        ✏
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => onDelete(index)}
        className="text-error"
      >
        ✕
      </Button>
    </div>
  );
}
