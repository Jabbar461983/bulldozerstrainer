import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { Card } from '../../components/Card';
import {
  computeTaskStats,
  fetchAllTasks,
  fetchTaskRecipientOptions,
  fetchTaskTeamOptions,
  isOverdue,
} from './api';
import type { TaskRow, TaskStats } from './api';
import { TaskDetailDialog } from './TaskDetailDialog';

interface StatsRow {
  key: string;
  label: string;
  stats: TaskStats;
  tasks: TaskRow[];
}

/** 'all' = Zeile angeklickt (alle Aufgaben, gruppiert), sonst Badge-Filter. */
type ExpandFilter = 'all' | 'offen' | 'erledigt' | 'ueberfaellig';

interface Expanded {
  rowKey: string;
  filter: ExpandFilter;
}

function formatDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function sortByDue(tasks: TaskRow[]): TaskRow[] {
  return [...tasks].sort((a, b) => a.due_date.localeCompare(b.due_date));
}

function StatsBadges({
  stats,
  active,
  onSelect,
}: {
  stats: TaskStats;
  active: ExpandFilter | null;
  onSelect: (filter: ExpandFilter) => void;
}) {
  const badge = (filter: ExpandFilter, label: string, count: number, style: string) => (
    <button
      type="button"
      disabled={count === 0}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(filter);
      }}
      className={clsx(
        'rounded-full px-2.5 py-1 transition enabled:hover:ring-2 enabled:hover:ring-current/30 disabled:cursor-default',
        style,
        active === filter && 'ring-2 ring-current/50',
      )}
    >
      {label}: {count}
    </button>
  );
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {badge('offen', 'Offen', stats.offen, 'bg-surface-alt text-text-muted')}
      {badge('erledigt', 'Erledigt', stats.erledigt, 'bg-success/10 text-success')}
      {badge('ueberfaellig', 'Überfällig', stats.ueberfaellig, 'bg-danger/10 text-danger')}
    </div>
  );
}

function TaskList({
  tasks,
  showAssignee,
  onSelect,
}: {
  tasks: TaskRow[];
  showAssignee: boolean;
  onSelect: (task: TaskRow) => void;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {tasks.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => onSelect(t)}
            className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2 text-left hover:bg-surface-alt"
          >
            <span className="font-medium text-text">{t.title}</span>
            <span className="text-xs text-text-muted">
              Fällig {formatDate(t.due_date)}
              {showAssignee && ` · ${t.assigneeName}`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ExpandedTasks({
  row,
  filter,
  showAssignee,
  onSelect,
}: {
  row: StatsRow;
  filter: ExpandFilter;
  showAssignee: boolean;
  onSelect: (task: TaskRow) => void;
}) {
  const overdue = sortByDue(row.tasks.filter((t) => !t.completed && isOverdue(t.due_date)));
  const open = sortByDue(row.tasks.filter((t) => !t.completed));
  const openNotOverdue = open.filter((t) => !isOverdue(t.due_date));
  const done = sortByDue(row.tasks.filter((t) => t.completed));

  const sections: { title: string; tasks: TaskRow[]; style: string }[] =
    filter === 'all'
      ? [
          { title: 'Überfällig', tasks: overdue, style: 'text-danger' },
          { title: 'Offen', tasks: openNotOverdue, style: 'text-text-muted' },
          { title: 'Erledigt', tasks: done, style: 'text-success' },
        ]
      : filter === 'ueberfaellig'
        ? [{ title: 'Überfällig', tasks: overdue, style: 'text-danger' }]
        : filter === 'offen'
          ? [{ title: 'Offen (inkl. überfällige)', tasks: open, style: 'text-text-muted' }]
          : [{ title: 'Erledigt', tasks: done, style: 'text-success' }];

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
      {sections.map((section) => (
        <div key={section.title}>
          <p className={clsx('text-xs font-semibold uppercase tracking-wide', section.style)}>
            {section.title} ({section.tasks.length})
          </p>
          {section.tasks.length === 0 ? (
            <p className="py-1 text-sm text-text-muted">Keine.</p>
          ) : (
            <TaskList tasks={section.tasks} showAssignee={showAssignee} onSelect={onSelect} />
          )}
        </div>
      ))}
    </div>
  );
}

export function TasksStatsPage() {
  const [teamRows, setTeamRows] = useState<StatsRow[] | null>(null);
  const [personRows, setPersonRows] = useState<StatsRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Expanded | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  function toggle(rowKey: string, filter: ExpandFilter) {
    setExpanded((prev) => (prev?.rowKey === rowKey && prev.filter === filter ? null : { rowKey, filter }));
  }

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
        const teamStats: StatsRow[] = teamMemberships
          .map(({ team, members }) => {
            const memberIds = new Set(members.map((m) => m.userId));
            const teamTasks = allTasks.filter((t) => memberIds.has(t.assigned_to));
            return {
              key: `team:${team.teamId}`,
              label: `${team.categoryName} · ${team.teamName}`,
              stats: computeTaskStats(teamTasks),
              tasks: teamTasks,
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
        const personStats: StatsRow[] = Array.from(byPerson.entries())
          .map(([userId, tasks]) => ({
            key: `person:${userId}`,
            label: tasks[0].assigneeName,
            stats: computeTaskStats(tasks),
            tasks,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'de-CH'));
        setPersonRows(personStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Übersicht konnte nicht geladen werden.');
      }
    }
    void load();
  }, [reloadKey]);

  function renderRow(row: StatsRow, showAssignee: boolean) {
    const active = expanded?.rowKey === row.key ? expanded.filter : null;
    return (
      <Card
        key={row.key}
        role="button"
        tabIndex={0}
        onClick={() => toggle(row.key, 'all')}
        onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && toggle(row.key, 'all')}
        className="cursor-pointer"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-medium text-text">
            <span className={clsx('text-xs text-text-muted transition', active && 'rotate-90')}>▶</span>
            {row.label}
          </p>
          <StatsBadges stats={row.stats} active={active} onSelect={(filter) => toggle(row.key, filter)} />
        </div>
        {active && (
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="cursor-default">
            <ExpandedTasks row={row} filter={active} showAssignee={showAssignee} onSelect={setSelectedTask} />
          </div>
        )}
      </Card>
    );
  }

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
          {teamRows.map((row) => renderRow(row, true))}
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
          {personRows.map((row) => renderRow(row, false))}
        </div>
      )}

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onChanged={() => {
            setSelectedTask(null);
            setReloadKey((k) => k + 1);
          }}
          onDeleted={() => {
            setSelectedTask(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
