import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { updateCategory } from './api';
import type { Category } from '../../types/database';

interface EditCategoryDialogProps {
  category: Category;
  onClose: () => void;
  onSaved: () => void;
}

export function EditCategoryDialog({ category, onClose, onSaved }: EditCategoryDialogProps) {
  const [name, setName] = useState(category.name);
  const [sortOrder, setSortOrder] = useState(category.sort_order);
  const [isDefault, setIsDefault] = useState(category.is_default);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateCategory(category.id, { name, sort_order: sortOrder, is_default: isDefault });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Änderungen konnten nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={`Kategorie „${category.name}“ bearbeiten`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="edit-category-form" disabled={loading}>
            {loading ? 'Speichern…' : 'Speichern'}
          </Button>
        </>
      }
    >
      <form id="edit-category-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="categoryName">Name</Label>
          <Input id="categoryName" required value={name} onChange={(e) => setName(e.target.value)} />
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
