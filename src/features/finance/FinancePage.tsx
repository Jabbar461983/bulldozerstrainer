import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, LinkButton } from '../../components/Button';
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
import { fetchBudget, fetchBudgetTeamIds, fetchReceipts } from './api';
import type { ReceiptRow } from './api';
import type { Budget } from '../../types/database';
import { BudgetSection } from './BudgetSection';
import { FinanceJournal } from './FinanceJournal';
import { CreateReceiptDialog } from './CreateReceiptDialog';

// Sentinel für den <select>-Wert, da HTML-Optionen keinen echten null-Wert
// transportieren können. Steht für "Verein" (team_id null), nur für Admins.
const CLUB_SCOPE = '__club__';
const CLUB_LABEL = 'Verein (kein Team)';

export function FinancePage() {
  const { isAdmin, memberships, canAccess } = useAuth();
  // "Verein" und Gesamtübersicht: Modul finanzen_verein (Admin hat es immer).
  const canClub = canAccess('finanzen_verein');
  const [searchParams] = useSearchParams();
  // Absprung aus der Gesamtübersicht: ?team=<id|__club__>&season=<saison>
  const [requestedTeamId] = useState(() => searchParams.get('team'));
  const [teamOptions, setTeamOptions] = useState<TeamOption[] | null>(null);
  const [budgetTeamIds, setBudgetTeamIds] = useState<Set<string | null> | null>(null);
  const [showTeamsWithoutBudget, setShowTeamsWithoutBudget] = useState(false);
  const [teamId, setTeamId] = useState('');
  const [season, setSeason] = useState(() => searchParams.get('season') || currentSeason());
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
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Teams konnten nicht geladen werden.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBudgetTeamIds(currentSeasonValue: string) {
    if (!currentSeasonValue) return;
    try {
      const result = await withCache(`finance-budget-teams:${currentSeasonValue}`, () =>
        fetchBudgetTeamIds(currentSeasonValue),
      );
      setBudgetTeamIds(new Set(result.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Budgets konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void loadBudgetTeamIds(season);
  }, [season]);

  // Nur Teams mit hinterlegtem Budget (Saison-abhängig). Admins können
  // weitere Teams einblenden, um dort ein erstes Budget zu erfassen.
  const visibleTeamOptions = useMemo(() => {
    if (!teamOptions || !budgetTeamIds) return null;
    if (isAdmin && showTeamsWithoutBudget) return teamOptions;
    return teamOptions.filter((t) => budgetTeamIds.has(t.teamId) || t.teamId === requestedTeamId);
  }, [teamOptions, budgetTeamIds, isAdmin, showTeamsWithoutBudget, requestedTeamId]);

  // Auswahl gültig halten, wenn sich die sichtbaren Teams ändern.
  useEffect(() => {
    if (!visibleTeamOptions) return;
    const isValid =
      (teamId === CLUB_SCOPE && canClub) || visibleTeamOptions.some((t) => t.teamId === teamId);
    if (isValid) return;
    if (requestedTeamId && !teamId) {
      if (requestedTeamId === CLUB_SCOPE && canClub) return setTeamId(CLUB_SCOPE);
      if (visibleTeamOptions.some((t) => t.teamId === requestedTeamId)) return setTeamId(requestedTeamId);
    }
    if (visibleTeamOptions.length > 0) setTeamId(visibleTeamOptions[0].teamId);
    else setTeamId(canClub ? CLUB_SCOPE : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTeamOptions]);

  const isClubScope = teamId === CLUB_SCOPE;
  const resolvedTeamId = isClubScope ? null : teamId || null;
  const selectedTeam = teamOptions?.find((t) => t.teamId === teamId) ?? null;
  const displayName = isClubScope ? CLUB_LABEL : selectedTeam?.teamName;

  async function load(currentTeamId: string | null, currentSeasonValue: string) {
    if (currentTeamId === '' || !currentSeasonValue) return;
    setError(null);
    try {
      const cacheKey = currentTeamId ?? CLUB_SCOPE;
      const result = await withCache(`finance:${cacheKey}:${currentSeasonValue}`, async () => {
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
    if (teamId && season) void load(resolvedTeamId, season);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, season]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-text">Finanzen</h1>
        <div className="flex flex-wrap items-center gap-2">
          {canClub && <LinkButton to="/finanzen/uebersicht">Gesamtübersicht</LinkButton>}
          <Button disabled={!teamId} onClick={() => setShowCreateReceipt(true)}>
            + Neuer Beleg
          </Button>
        </div>
      </div>

      {teamOptions !== null && teamOptions.length === 0 && !canClub && (
        <Card>
          <p className="text-sm text-text-muted">
            Dir ist kein Team für Finanzen zugewiesen. Bitte wende dich an einen Admin.
          </p>
        </Card>
      )}

      {teamOptions !== null &&
        teamOptions.length > 0 &&
        visibleTeamOptions !== null &&
        visibleTeamOptions.length === 0 &&
        !canClub && (
          <Card>
            <p className="text-sm text-text-muted">
              Für die Saison {season} ist für dein Team noch kein Budget hinterlegt. Bitte wende dich an einen
              Admin.
            </p>
          </Card>
        )}

      {visibleTeamOptions && (visibleTeamOptions.length > 0 || canClub) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="team">Team</Label>
            <Select id="team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {visibleTeamOptions.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.categoryName} · {t.teamName}
                </option>
              ))}
              {canClub && <option value={CLUB_SCOPE}>{CLUB_LABEL}</option>}
            </Select>
            {isAdmin && (
              <label className="mt-1.5 flex items-center gap-2 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={showTeamsWithoutBudget}
                  onChange={(e) => setShowTeamsWithoutBudget(e.target.checked)}
                />
                Auch Teams ohne Budget anzeigen
              </label>
            )}
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

      {receipts !== null && displayName && (
        <>
          <BudgetSection
            teamId={resolvedTeamId}
            season={season}
            budget={budget}
            onSaved={() => {
              void load(resolvedTeamId, season);
              void loadBudgetTeamIds(season);
            }}
          />
          <FinanceJournal
            receipts={receipts}
            startingBalance={budget?.amount ?? 0}
            teamName={displayName}
            season={season}
            onChanged={() => void load(resolvedTeamId, season)}
          />
        </>
      )}

      {showCreateReceipt && teamId && (
        <CreateReceiptDialog
          teamId={resolvedTeamId}
          season={season}
          onClose={() => setShowCreateReceipt(false)}
          onCreated={() => {
            setShowCreateReceipt(false);
            void load(resolvedTeamId, season);
          }}
        />
      )}
    </div>
  );
}
