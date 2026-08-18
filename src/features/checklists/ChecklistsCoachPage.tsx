import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { OfflineNotice } from '../../components/OfflineNotice';
import { withCache } from '../../lib/withCache';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import { fetchChecklists, fetchChecklistInstances, fetchArchivedChecklistInstances } from './api';
import type { ChecklistRow } from './api';
import { ChecklistInstanceWorkspace } from './ChecklistInstanceWorkspace';
import { useAuth } from '../../auth/AuthContext';

interface ChecklistWithProgress extends ChecklistRow {
  activeProgress?: { completed: number; total: number };
  archivedCount?: number;
}

export function ChecklistsCoachPage() {
  const { memberships, isAdmin } = useAuth();
  const [teamOptions, setTeamOptions] = useState<TeamOption[] | null>(null);
  const [teamId, setTeamId] = useState('');
  const [checklists, setChecklists] = useState<ChecklistWithProgress[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineCachedAt, setOfflineCachedAt] = useState<number | null>(null);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);

  useEffect(() => {
    withCache('team-options', fetchTeamOptions)
      .then((result) => {
        // Filter teams based on user memberships (non-admins only see their teams)
        let filtered = result.data;
        if (!isAdmin && memberships.length > 0) {
          const membershipTeamIds = new Set(memberships.map((m) => m.teamId));
          filtered = result.data.filter((t) => membershipTeamIds.has(t.teamId));
        }
        setTeamOptions(filtered);
        if (filtered.length > 0) setTeamId(filtered[0].teamId);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Teams konnten nicht geladen werden.'));
  }, [memberships, isAdmin]);

  async function load() {
    setError(null);
    try {
      const result = await withCache('checklists:coach', fetchChecklists);
      const checklistsData = result.data as ChecklistWithProgress[];

      // Fetch progress for each checklist
      for (const checklist of checklistsData) {
        try {
          const instances = await fetchChecklistInstances(checklist.id);
          const archivedInstances = await fetchArchivedChecklistInstances(checklist.id);

          // Calculate total progress across all active instances
          let totalCompleted = 0;
          let totalItems = checklist.items.length;

          for (const instance of instances) {
            totalCompleted += instance.progress.completed;
          }

          checklist.activeProgress = { completed: totalCompleted, total: totalItems * instances.length };
          checklist.archivedCount = archivedInstances.length;
        } catch (err) {
          // If error fetching progress, just show no progress
          checklist.activeProgress = { completed: 0, total: 0 };
          checklist.archivedCount = 0;
        }
      }

      setChecklists(checklistsData);
      setOfflineCachedAt(result.fromCache ? result.cachedAt : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checklisten konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredChecklists = checklists?.filter(
    (c) => c.is_global || (teamId && c.teamIds.includes(teamId)),
  ) ?? [];

  if (selectedChecklistId) {
    const checklist = checklists?.find((c) => c.id === selectedChecklistId);
    if (checklist) {
      return (
        <ChecklistInstanceWorkspace
          checklist={checklist}
          teamId={teamId}
          onClose={() => setSelectedChecklistId(null)}
        />
      );
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Checklisten</h1>

      {offlineCachedAt && <OfflineNotice cachedAt={offlineCachedAt} />}

      {error && (
        <div className="rounded-lg bg-error/10 p-4 text-error">
          {error}
        </div>
      )}

      {teamOptions && teamOptions.length > 1 && (
        <div>
          <label className="block text-sm font-medium mb-2">Mein Team</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
          >
            {teamOptions.map((team) => (
              <option key={team.teamId} value={team.teamId}>
                {team.teamName}
              </option>
            ))}
          </select>
        </div>
      )}

      {checklists === null ? (
        <div className="flex justify-center py-8 text-text-muted">Lädt...</div>
      ) : filteredChecklists.length === 0 ? (
        <Card>
          <p className="text-center text-text-muted">Keine Checklisten verfügbar.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {filteredChecklists.map((checklist) => {
              const progressDisplay = checklist.activeProgress
                ? `${checklist.activeProgress.completed} von ${checklist.items.length}`
                : `0 von ${checklist.items.length}`;
              return (
                <Card
                  key={checklist.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedChecklistId(checklist.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedChecklistId(checklist.id)}
                  className="cursor-pointer hover:bg-surface-alt"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-text">{checklist.title}</p>
                      {checklist.description && (
                        <p className="text-sm text-text-muted">{checklist.description}</p>
                      )}
                      <p className="text-xs text-text-muted mt-1">{progressDisplay} erledigt</p>
                    </div>
                    <Button variant="secondary">Abhaken →</Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {filteredChecklists.some((c) => c.archivedCount && c.archivedCount > 0) && (
            <div className="pt-4 border-t border-border">
              <h2 className="text-lg font-semibold mb-3">📋 Archiv - Erledigte Checklisten</h2>
              <div className="space-y-2">
                {filteredChecklists.map((checklist) => {
                  if (!checklist.archivedCount || checklist.archivedCount === 0) return null;
                  return (
                    <Card
                      key={`archived-${checklist.id}`}
                      className="opacity-75"
                    >
                      <div>
                        <p className="font-semibold text-text">{checklist.title}</p>
                        {checklist.description && (
                          <p className="text-sm text-text-muted">{checklist.description}</p>
                        )}
                        <p className="text-xs text-text-muted mt-1">
                          {checklist.archivedCount} {checklist.archivedCount === 1 ? 'Eintrag' : 'Einträge'} archiviert
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
