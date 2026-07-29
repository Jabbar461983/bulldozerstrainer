import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Select } from '../../components/Select';
import { Input, Label } from '../../components/Input';
import { OfflineNotice } from '../../components/OfflineNotice';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import { currentSeason } from '../../lib/dates';
import { withCache } from '../../lib/withCache';
import { useAuth } from '../../auth/AuthContext';
import { accessibleTeamIds } from '../../auth/permissions';
import { fetchBudget, fetchReceipts } from './api';
import type { ReceiptRow } from './api';
import type { Budget } from '../../types/database';
import { BudgetSection } from './BudgetSection';
import { FinanceJournal } from './FinanceJournal';
import { CreateReceiptDialog } from './CreateReceiptDialog';

export function FinancePage() {
  const { isAdmin, memberships } = useAuth();
  const [teamOptions, setTeamOptions] = useState<TeamOption[] | null>(null);
  const [teamId, setTeamId] = useState('');
  const [season, setSeason] = useState(currentSeason());
  const [budget, setBudget] = useState<Budget | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineCachedAt, setOfflineCachedAt] = useState<number | null>(null);
  const [showCreateReceipt, setShowCreateReceipt] = useState(false);

  useEffect(() => {
    withCache('team-options', fetchTeamOptions)
      .then((result) => {
        const scope = accessibleTeamIds('finanzen', isAdmin, memberships);
        const filtered = scope.allTeams ? result.data : result.data.filter((t) => scope.teamIds.includes(t.teamId));
        setTeamOptions(filtered);
        if (filtered.length > 0) setTeamId(filtered[0].teamId);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Teams konnten nicht geladen werden.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTeam = teamOptions?.find((t) => t.teamId === teamId) ?? null;

  async function load(currentTeamId: string, currentSeasonValue: string) {
    if (!currentTeamId || !currentSeasonValue) return;
    setError(null);
    try {
      const result = await withCache(`finance:${currentTeamId}:${currentSeasonValue}`, async () => {
        const [budgetRow, receiptRows] = await Promise.all([
          fetchBudget(currentTeamId, currentSeasonValue),
          fetchReceipts(currentTeamId, currentSeasonValue),
        ]);
        return { budgetRow, receiptRows };
      });
      setBudget(result.data.budgetRow);
      setReceipts(result.data.receiptRows);
      setOfflineCachedAt(result.fromCache ? result.cachedAt : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Finanzdaten konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    if (teamId && season) void load(teamId, season);
  }, [teamId, season]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">Finanzen</h1>
        <Button disabled={!teamId} onClick={() => setShowCreateReceipt(true)}>
          + Neuer Beleg
        </Button>
      </div>

      {teamOptions !== null && teamOptions.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">
            Dir ist kein Team für Finanzen zugewiesen. Bitte wende dich an einen Admin.
          </p>
        </Card>
      )}

      {teamOptions && teamOptions.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="team">Team</Label>
            <Select id="team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teamOptions.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.categoryName} · {t.teamName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="season">Saison</Label>
            <Input id="season" value={season} onChange={(e) => setSeason(e.target.value)} />
          </div>
        </div>
      )}

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {offlineCachedAt && <OfflineNotice cachedAt={offlineCachedAt} />}

      {receipts === null && teamId && <p className="text-sm text-text-muted">Lädt…</p>}

      {receipts !== null && selectedTeam && (
        <>
          <BudgetSection
            teamId={teamId}
            season={season}
            budget={budget}
            onSaved={() => void load(teamId, season)}
          />
          <FinanceJournal
            receipts={receipts}
            startingBalance={budget?.amount ?? 0}
            teamName={selectedTeam.teamName}
            season={season}
            onChanged={() => void load(teamId, season)}
          />
        </>
      )}

      {showCreateReceipt && teamId && (
        <CreateReceiptDialog
          teamId={teamId}
          season={season}
          onClose={() => setShowCreateReceipt(false)}
          onCreated={() => {
            setShowCreateReceipt(false);
            void load(teamId, season);
          }}
        />
      )}
    </div>
  );
}
