import { useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { upsertBudget } from './api';
import { useAuth } from '../../auth/AuthContext';
import type { Budget } from '../../types/database';

interface BudgetSectionProps {
  teamId: string;
  season: string;
  budget: Budget | null;
  onSaved: () => void;
}

export function BudgetSection({ teamId, season, budget, onSaved }: BudgetSectionProps) {
  const { isAdmin, profile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(budget?.amount != null ? String(budget.amount) : '0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await upsertBudget(teamId, season, Number(amount), profile?.id ?? null);
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Budget konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
      <div>
        <p className="text-xs text-text-muted">Budget {season}</p>
        {!editing ? (
          <p className="text-lg font-semibold text-text">CHF {(budget?.amount ?? 0).toFixed(2)}</p>
        ) : (
          <Input
            type="number"
            step="0.05"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32"
          />
        )}
      </div>
      {isAdmin && !editing && (
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Bearbeiten
        </Button>
      )}
      {isAdmin && editing && (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Abbrechen
          </Button>
          <Button disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </div>
      )}
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}
