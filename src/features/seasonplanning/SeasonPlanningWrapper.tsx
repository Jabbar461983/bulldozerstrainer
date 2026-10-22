import { useEffect, useState } from 'react';
import type { TeamOption } from '../../lib/teams';
import { fetchTeamOptions } from '../../lib/teams';
import { useAuth } from '../../auth/AuthContext';
import { filterTeamsForModule } from '../../auth/permissions';
import { withCache } from '../../lib/withCache';
import { Select } from '../../components/Select';
import { OfflineNotice } from '../../components/OfflineNotice';
import { SeasonPlanningPage } from './SeasonPlanningPage';

export function SeasonPlanningWrapper() {
  const { isAdmin, memberships } = useAuth();
  const [teamOptions, setTeamOptions] = useState<TeamOption[] | null>(null);
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [offlineCachedAt, setOfflineCachedAt] = useState<number | null>(null);

  useEffect(() => {
    withCache('team-options', fetchTeamOptions)
      .then((result) => {
        const visible = filterTeamsForModule(result.data, 'saisonplanung', isAdmin, memberships);
        setTeamOptions(visible);
        if (visible.length > 0) setTeamId(visible[0].teamId);
        if (result.fromCache) setOfflineCachedAt(result.cachedAt);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Teams konnten nicht geladen werden.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, memberships]);

  if (error) {
    console.error('SeasonPlanningWrapper error:', error);
    return <div className="p-6 text-red-600">Fehler: {error}</div>;
  }

  if (!teamOptions) {
    return <div className="p-6 text-text-muted">Lädt Teams...</div>;
  }

  const selectedTeam = teamOptions.find((t) => t.teamId === teamId) ?? null;

  return (
    <div className="space-y-6">
      {offlineCachedAt && <OfflineNotice cachedAt={offlineCachedAt} />}

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-text-muted">Team</label>
          <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teamOptions.map((opt) => (
              <option key={opt.teamId} value={opt.teamId}>
                {opt.categoryName} · {opt.teamName}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {selectedTeam && (
        <SeasonPlanningPage teamId={selectedTeam.teamId} season={selectedTeam.season} teamName={selectedTeam.teamName} />
      )}
    </div>
  );
}
