import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Label } from '../../components/Input';
import { Select } from '../../components/Select';
import {
  deriveTaskStatus,
  fetchAllTasks,
  fetchTaskRecipientOptions,
  fetchTaskTeamOptions,
  TASK_STATUS_LABELS,
} from './api';
import type { TaskRow, TeamOptionForTask } from './api';
import { TaskDetailDialog } from './TaskDetailDialog';

const ALL = '__all__';

function formatDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function TasksOverviewPage() {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [teams, setTeams] = useState<TeamOptionForTask[]>([]);
  const [teamMemberIds, setTeamMemberIds] = useState<Map<string, Set<string>>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const [personFilter, setPersonFilter] = useState(ALL);
  const [teamFilter, setTeamFilter] = useState(ALL);

  async function load() {
    setError(null);
    try {
      const [allTasks, teamOptions] = await Promise.all([fetchAllTasks(), fetchTaskTeamOptions()]);
      setTasks(allTasks);
      setTeams(teamOptions);
      const memberships = await Promise.all(
        teamOptions.map(async (team) => ({
          teamId: team.teamId,
          memberIds: new Set((await fetchTaskRecipientOptions('team_coaches', team.teamId)).map((m) => m.userId)),
        })),
      );
      setTeamMemberIds(new Map(memberships.map((m) => [m.teamId, m.memberIds])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übersicht konnte nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const persons = useMemo(() => {
    const byId = new Map<string, string>();
    for (const t of tasks ?? []) byId.set(t.assigned_to, t.assigneeName);
    return Array.from(byId.entries())
      .map(([userId, name]) => ({ userId, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return (tasks ?? []).filter((t) => {
      if (personFilter !== ALL && t.assigned_to !== personFilter) return false;
      if (teamFilter !== ALL && !(teamMemberIds.get(teamFilter)?.has(t.assigned_to) ?? false)) return false;
      return true;
    });
  }, [tasks, personFilter, teamFilter, teamMemberIds]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">Aufgaben · Gesamtübersicht</h1>
        <Link to="/aufgaben" className="text-sm font-medium text-accent hover:underline">
          Zurück zu Aufgaben
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="personFilter">Person</Label>
          <Select id="personFilter" value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}>
            <option value={ALL}>Alle</option>
            {persons.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="teamFilter">Team</Label>
          <Select id="teamFilter" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value={ALL}>Alle</option>
            {teams.map((t) => (
              <option key={t.teamId} value={t.teamId}>
                {t.categoryName} · {t.teamName}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {tasks === null && !error && <p className="text-sm text-text-muted">Lädt…</p>}
      {tasks !== null && filteredTasks.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Keine Aufgaben gefunden.</p>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {filteredTasks.map((t) => {
          const status = deriveTaskStatus(t);
          const styles: Record<string, string> = {
            offen: 'bg-surface-alt text-text-muted',
            in_arbeit: 'bg-warning/10 text-warning',
            erledigt: 'bg-success/10 text-success',
          };
          return (
            <Card key={t.id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedTask(t)}
                  className="font-medium text-accent hover:underline"
                >
                  {t.title}
                </button>
                <p className="text-sm text-text-muted">
                  Erfasser: {t.creatorName} · Empfänger: {t.assigneeName} · Fällig: {formatDate(t.due_date)}
                  {t.is_team_task && ' · Teamaufgabe'}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
                {TASK_STATUS_LABELS[status]}
              </span>
            </Card>
          );
        })}
      </div>

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onChanged={() => {
            setSelectedTask(null);
            void load();
          }}
          onDeleted={() => {
            setSelectedTask(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
