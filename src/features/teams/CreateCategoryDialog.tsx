import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { createCategory } from './api';

interface CreateCategoryDialogProps {
  nextSortOrder: number;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateCategoryDialog({ nextSortOrder, onClose, onCreated }: CreateCategoryDialogProps) {
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState(nextSortOrder);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createCategory({ name, sort_order: sortOrder, is_default: isDefault });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kategorie konnte nicht angelegt werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Neue Alterskategorie anlegen"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="create-category-form" disabled={loading}>
            {loading ? 'Anlegen…' : 'Kategorie anlegen'}
          </Button>
        </>
      }
    >
      <form id="create-category-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="categoryName">Name</Label>
          <Input id="categoryName" required placeholder="z.B. U15" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="sortOrder">Reihenfolge</Label>
          <Input
            id="sortOrder"
            type="number"
            required
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            className="size-5"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          Standardkategorie
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
