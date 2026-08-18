import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Input, Label } from '../../components/Input';
import { currentSeason } from '../../lib/dates';
import { fetchFinanceOverview } from './api';
import type { TeamFinanceSummary } from './api';

export function FinanceOverviewPage() {
  const [season, setSeason] = useState(currentSeason());
  const [rows, setRows] = useState<TeamFinanceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!season) return;
    setError(null);
    fetchFinanceOverview(season)
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Übersicht konnte nicht geladen werden.'));
  }, [season]);

  const totals = (rows ?? []).reduce(
    (acc, r) => ({
      budget: acc.budget + r.budget,
      income: acc.income + r.income,
      expense: acc.expense + r.expense,
      saldo: acc.saldo + r.saldo,
    }),
    { budget: 0, income: 0, expense: 0, saldo: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">Finanzen · Gesamtübersicht</h1>
        <Link to="/finanzen" className="text-sm font-medium text-accent hover:underline">
          Zurück zu Finanzen
        </Link>
      </div>

      <div className="max-w-xs">
        <Label htmlFor="season">Saison</Label>
        <Input id="season" value={season} onChange={(e) => setSeason(e.target.value)} />
      </div>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {rows === null && !error && <p className="text-sm text-text-muted">Lädt…</p>}

      {rows !== null && (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <Card key={r.teamId ?? 'club'}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-text">
                  {r.categoryName ? `${r.categoryName} · ${r.teamName}` : r.teamName}
                </p>
                <span className={r.saldo >= 0 ? 'font-semibold text-success' : 'font-semibold text-danger'}>
                  Saldo: CHF {r.saldo.toFixed(2)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-text-muted">Budget</p>
                  <p className="font-medium text-text">CHF {r.budget.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-text-muted">Einnahmen</p>
                  <p className="font-medium text-success">CHF {r.income.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-text-muted">Ausgaben</p>
                  <p className="font-medium text-danger">CHF {r.expense.toFixed(2)}</p>
                </div>
              </div>
            </Card>
          ))}

          {rows.length > 0 && (
            <Card className="border-accent/40 bg-accent/5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-text">Total</p>
                <span className={totals.saldo >= 0 ? 'font-semibold text-success' : 'font-semibold text-danger'}>
                  Saldo: CHF {totals.saldo.toFixed(2)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-text-muted">Budget</p>
                  <p className="font-medium text-text">CHF {totals.budget.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-text-muted">Einnahmen</p>
                  <p className="font-medium text-success">CHF {totals.income.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-text-muted">Ausgaben</p>
                  <p className="font-medium text-danger">CHF {totals.expense.toFixed(2)}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
