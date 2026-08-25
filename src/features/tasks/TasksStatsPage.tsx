import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/Card';
import {
  computeTaskStats,
  fetchAllTasks,
  fetchTaskRecipientOptions,
  fetchTaskTeamOptions,
} from './api';
import type { TaskRow, TaskStats } from './api';

interface TeamStatsRow {
  key: string;
  label: string;
  stats: TaskStats;
}

interface PersonStatsRow {
  key: string;
  label: string;
  stats: TaskStats;
}

function StatsBadges({ stats }: { stats: TaskStats }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      <span className="rounded-full bg-surface-alt px-2.5 py-1 text-text-muted">Offen: {stats.offen}</span>
      <span className="rounded-full bg-success/10 px-2.5 py-1 text-success">Erledigt: {stats.erledigt}</span>
      <span className="rounded-full bg-danger/10 px-2.5 py-1 text-danger">Überfällig: {stats.ueberfaellig}</span>
    </div>
  );
}

export function TasksStatsPage() {
  const [teamRows, setTeamRows] = useState<TeamStatsRow[] | null>(null);
  const [personRows, setPersonRows] = useState<PersonStatsRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const [allTasks, teams] = await Promise.all([fetchAllTasks(), fetchTaskTeamOptions()]);

        const teamMemberships = await Promise.all(
          teams.map(async (team) => ({
            team,
            members: await fetchTaskRecipientOptions('team_coaches', team.teamId),
          })),
        );
        const teamStats: TeamStatsRow[] = teamMemberships
          .map(({ team, members }) => {
            const memberIds = new Set(members.map((m) => m.userId));
            const teamTasks = allTasks.filter((t) => memberIds.has(t.assigned_to));
            return {
              key: team.teamId,
              label: `${team.categoryName} · ${team.teamName}`,
              stats: computeTaskStats(teamTasks),
            };
          })
          .filter((row) => row.stats.offen + row.stats.erledigt > 0);
        setTeamRows(teamStats);

        const byPerson = new Map<string, TaskRow[]>();
        for (const t of allTasks) {
          const list = byPerson.get(t.assigned_to) ?? [];
          list.push(t);
          byPerson.set(t.assigned_to, list);
        }
        const personStats: PersonStatsRow[] = Array.from(byPerson.entries())
          .map(([userId, tasks]) => ({
            key: userId,
            label: tasks[0].assigneeName,
            stats: computeTaskStats(tasks),
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'de-CH'));
        setPersonRows(personStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Übersicht konnte nicht geladen werden.');
      }
    }
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">Aufgaben · Übersicht Team/Person</h1>
        <Link to="/aufgaben" className="text-sm font-medium text-accent hover:underline">
          Zurück zu Aufgaben
        </Link>
      </div>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {(teamRows === null || personRows === null) && !error && <p className="text-sm text-text-muted">Lädt…</p>}

      {teamRows !== null && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-text-muted">Nach Team</h2>
          {teamRows.length === 0 && (
            <Card>
              <p className="text-sm text-text-muted">Keinem Team sind Aufgaben zugeteilt.</p>
            </Card>
          )}
          {teamRows.map((row) => (
            <Card key={row.key} className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-text">{row.label}</p>
              <StatsBadges stats={row.stats} />
            </Card>
          ))}
        </div>
      )}

      {personRows !== null && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-text-muted">Nach Person</h2>
          {personRows.length === 0 && (
            <Card>
              <p className="text-sm text-text-muted">Niemandem sind Aufgaben zugeteilt.</p>
            </Card>
          )}
          {personRows.map((row) => (
            <Card key={row.key} className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-text">{row.label}</p>
              <StatsBadges stats={row.stats} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
