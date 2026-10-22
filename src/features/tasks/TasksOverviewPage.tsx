import { TaskCategoryBadge } from './TaskCategoryBadge';
import { SeriesIcon } from './SeriesIcon';
import { useEffect, useMemo, useState } from 'react';
import { BackLinkButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { List, ListRow } from '../../components/List';
import { Label } from '../../components/Input';
import { Select } from '../../components/Select';
import {
  deriveTaskStatus,
  fetchAllTasks,
  fetchRessortMembers,
  fetchRessorts,
  TASK_CATEGORY_LABELS,
  fetchTaskRecipientOptions,
  fetchTaskTeamOptions,
  TASK_STATUS_LABELS,
} from './api';
import type { TaskRow, TeamOptionForTask } from './api';
import type { VorstandRessort } from '../../types/database';
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
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [ressortFilter, setRessortFilter] = useState(ALL);
  const [ressorts, setRessorts] = useState<VorstandRessort[]>([]);
  const [ressortMemberIds, setRessortMemberIds] = useState<Map<string, Set<string>>>(new Map());

  async function load() {
    setError(null);
    try {
      const [allTasks, teamOptions, ressortOptions, ressortMembers] = await Promise.all([
        fetchAllTasks(),
        fetchTaskTeamOptions(),
        fetchRessorts(),
        fetchRessortMembers(),
      ]);
      setTasks(allTasks);
      setTeams(teamOptions);
      setRessorts(ressortOptions);
      const byRessort = new Map<string, Set<string>>();
      for (const m of ressortMembers) {
        if (!m.ressortId) continue;
        const set = byRessort.get(m.ressortId) ?? new Set<string>();
        set.add(m.userId);
        byRessort.set(m.ressortId, set);
      }
      setRessortMemberIds(byRessort);
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
      const category = t.category ?? 'sport';
      if (personFilter !== ALL && t.assigned_to !== personFilter) return false;
      if (categoryFilter !== ALL && category !== categoryFilter) return false;
      // Team-Filter zeigt nur Sport-Aufgaben, Ressort-Filter nur Vorstands-Aufgaben.
      if (teamFilter !== ALL) {
        if (category !== 'sport') return false;
        if (!(teamMemberIds.get(teamFilter)?.has(t.assigned_to) ?? false)) return false;
      }
      if (ressortFilter !== ALL) {
        if (category !== 'vorstand') return false;
        if (!(ressortMemberIds.get(ressortFilter)?.has(t.assigned_to) ?? false)) return false;
      }
      return true;
    });
  }, [tasks, personFilter, teamFilter, categoryFilter, ressortFilter, teamMemberIds, ressortMemberIds]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-text">Aufgaben · Gesamtübersicht</h1>
        <BackLinkButton to="/aufgaben">Zurück zu Aufgaben</BackLinkButton>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="categoryFilter">Bereich</Label>
          <Select id="categoryFilter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value={ALL}>Alle</option>
            <option value="sport">{TASK_CATEGORY_LABELS.sport}</option>
            <option value="vorstand">{TASK_CATEGORY_LABELS.vorstand}</option>
          </Select>
        </div>
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
        <div>
          <Label htmlFor="ressortFilter">Ressort</Label>
          <Select id="ressortFilter" value={ressortFilter} onChange={(e) => setRessortFilter(e.target.value)}>
            <option value={ALL}>Alle</option>
            {ressorts.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
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

      <List>
        {filteredTasks.map((t) => {
          const status = deriveTaskStatus(t);
          const styles: Record<string, string> = {
            offen: 'bg-surface-alt text-text-muted',
            in_arbeit: 'bg-warning/10 text-warning',
            erledigt: 'bg-success/10 text-success',
          };
          return (
            <ListRow key={t.id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedTask(t)}
                  className="flex items-center gap-1.5 font-medium text-accent hover:underline"
                >
                  <SeriesIcon series={t.series} />
                  {t.title}
                </button>
                <p className="text-sm text-text-muted">
                  Erfasser: {t.creatorName} · Empfänger: {t.assigneeName} · Fällig: {formatDate(t.due_date)}
                  {t.is_team_task && ' · Teamaufgabe'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <TaskCategoryBadge category={t.category} />
                <span className={`rounded px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
                  {TASK_STATUS_LABELS[status]}
                </span>
              </div>
            </ListRow>
          );
        })}
      </List>

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
