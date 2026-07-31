import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import type { SeasonPlanningEvent, SeasonPlanningCategory } from '../../types/database';
import { createSeasonPlanningEvent, updateSeasonPlanningEvent, deleteSeasonPlanningEvent } from './api';

interface SeasonPlanningDialogProps {
  teamId: string;
  editingEvent?: SeasonPlanningEvent | null;
  onClose: () => void;
}

const CATEGORY_OPTIONS: { value: SeasonPlanningCategory; label: string }[] = [
  { value: 'activities', label: 'Aktivitäten' },
  { value: 'technique', label: 'Technik' },
  { value: 'tactics', label: 'Taktik' },
  { value: 'physical', label: 'Physis' },
];

const TECHNIQUE_SUBCATEGORIES = [
  'Passspiel',
  'Schiessen',
  'Ballabdecken',
  'Lösen vom Gegner',
  'Railabdecken',
  'Bullys',
  'Zweikampfverhalten',
];

const TACTICS_SUBCATEGORIES = [
  'Inside/Box-out',
  'Forechecking',
  'Offensivtaktiken',
  'Wechsel',
  'Specialteams',
];

const ACTIVITIES_SUBCATEGORIES = [
  'Testspiel',
  'Freundschaftsspiele',
  'Teamweihnachten',
  'Saisonabschluss',
];

const PHYSICAL_SUBCATEGORIES = [
  'Sommer-Training',
  'Body-pump',
];

function getSubcategoriesForCategory(category: SeasonPlanningCategory): string[] {
  switch (category) {
    case 'technique':
      return TECHNIQUE_SUBCATEGORIES;
    case 'tactics':
      return TACTICS_SUBCATEGORIES;
    case 'activities':
      return ACTIVITIES_SUBCATEGORIES;
    case 'physical':
      return PHYSICAL_SUBCATEGORIES;
    default:
      return [];
  }
}

export function SeasonPlanningDialog({ teamId, editingEvent, onClose }: SeasonPlanningDialogProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<SeasonPlanningCategory>('technique');
  const [subcategory, setSubcategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (editingEvent) {
      setTitle(editingEvent.title);
      setCategory(editingEvent.category);
      setSubcategory(editingEvent.subcategory ?? '');
      setStartDate(editingEvent.start_date);
      setEndDate(editingEvent.end_date);
      setNotes(editingEvent.notes ?? '');
    }
  }, [editingEvent]);

  const subcategories = getSubcategoriesForCategory(category);

  const handleSave = async () => {
    if (!startDate || !endDate || (category === 'activities' && !title)) {
      setError('Bitte füllen Sie alle erforderlichen Felder aus');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Das Startdatum muss vor dem Enddatum liegen');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingEvent) {
        await updateSeasonPlanningEvent(editingEvent.id, {
          title: category === 'activities' ? title : '',
          category,
          subcategory: subcategory || null,
          start_date: startDate,
          end_date: endDate,
          notes: notes || null,
        });
      } else {
        await createSeasonPlanningEvent({
          team_id: teamId,
          title: category === 'activities' ? title : '',
          category,
          subcategory: subcategory || null,
          start_date: startDate,
          end_date: endDate,
          notes: notes || null,
          sort_order: 0,
          is_template: false,
          created_by: null,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEvent) return;
    if (!confirm('Sind Sie sicher, dass Sie diesen Eintrag löschen möchten?')) return;

    setDeleting(true);
    setError(null);

    try {
      await deleteSeasonPlanningEvent(editingEvent.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 z-50">
      <div className="w-full max-w-md space-y-4 rounded-lg bg-surface p-6">
        <h2 className="text-lg font-bold text-text">
          {editingEvent ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
        </h2>

        {error && <div className="rounded bg-red-50 p-3 text-sm text-red-900">{error}</div>}

        <div className="space-y-3">
          {category === 'activities' && (
            <div>
              <label className="block text-sm font-medium text-text-muted">Titel *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-text placeholder-text-muted"
                placeholder="z.B. Meisterschaft"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-muted">Kategorie</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as SeasonPlanningCategory);
                setSubcategory('');
              }}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-text"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {subcategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text-muted">Subkategorie</label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-text"
              >
                <option value="">-- Keine Auswahl --</option>
                {subcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-muted">Startdatum *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted">Enddatum *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-text"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted">Notizen</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-text placeholder-text-muted"
              placeholder="Zusätzliche Notizen..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving || deleting}>
            Abbrechen
          </Button>
          {editingEvent && (
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? 'Löscht...' : 'Löschen'}
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || deleting}
            className="flex-1"
          >
            {saving ? 'Speichert...' : 'Speichern'}
          </Button>
        </div>
      </div>
    </div>
  );
}
