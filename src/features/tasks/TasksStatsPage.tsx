import { TaskCategoryBadge } from './TaskCategoryBadge';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { BackLinkButton } from '../../components/Button';
import { Card } from '../../components/Card';
import {
  computeTaskStats,
  fetchAllTasks,
  fetchRessortMembers,
  fetchRessorts,
  fetchTaskRecipientOptions,
  fetchTaskTeamOptions,
  isOverdue,
} from './api';
import type { TaskCategory } from '../../types/database';
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
        'rounded px-2.5 py-1 transition enabled:hover:ring-2 enabled:hover:ring-current/30 disabled:cursor-default',
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
            <span className="flex items-center gap-2 font-medium text-text">
              {t.title}
              <TaskCategoryBadge category={t.category} />
            </span>
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

interface CategoryView {
  /** Sport: nach Team, Vorstand: nach Ressort. */
  groupRows: StatsRow[];
  personRows: StatsRow[];
}

function buildPersonRows(tasks: TaskRow[], prefix: string): StatsRow[] {
  const byPerson = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    const list = byPerson.get(t.assigned_to) ?? [];
    list.push(t);
    byPerson.set(t.assigned_to, list);
  }
  return Array.from(byPerson.entries())
    .map(([userId, personTasks]) => ({
      key: `${prefix}:person:${userId}`,
      label: personTasks[0].assigneeName,
      stats: computeTaskStats(personTasks),
      tasks: personTasks,
    }))
    .sort((x, y) => x.label.localeCompare(y.label, 'de-CH'));
}

const TABS: { key: TaskCategory; label: string; groupTitle: string; empty: string }[] = [
  { key: 'vorstand', label: 'Vorstand', groupTitle: 'Nach Ressort', empty: 'Keinem Ressort sind Vorstands-Aufgaben zugeteilt.' },
  { key: 'sport', label: 'Sport', groupTitle: 'Nach Team', empty: 'Keinem Team sind Sport-Aufgaben zugeteilt.' },
];

export function TasksStatsPage() {
  const [views, setViews] = useState<Record<TaskCategory, CategoryView> | null>(null);
  const [tab, setTab] = useState<TaskCategory>('vorstand');
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
        const [allTasks, teams, ressorts, ressortMembers] = await Promise.all([
          fetchAllTasks(),
          fetchTaskTeamOptions(),
          fetchRessorts(),
          fetchRessortMembers(),
        ]);
        // Strikte Trennung: Sport-Aufgaben nur bei Teams, Vorstands-Aufgaben nur bei Ressorts.
        const sportTasks = allTasks.filter((t) => (t.category ?? 'sport') === 'sport');
        const vorstandTasks = allTasks.filter((t) => t.category === 'vorstand');

        const teamMemberships = await Promise.all(
          teams.map(async (team) => ({
            team,
            members: await fetchTaskRecipientOptions('team_coaches', team.teamId),
          })),
        );
        const teamRows: StatsRow[] = teamMemberships
          .map(({ team, members }) => {
            const memberIds = new Set(members.map((m) => m.userId));
            const teamTasks = sportTasks.filter((t) => memberIds.has(t.assigned_to));
            return {
              key: `team:${team.teamId}`,
              label: `${team.categoryName} · ${team.teamName}`,
              stats: computeTaskStats(teamTasks),
              tasks: teamTasks,
            };
          })
          .filter((row) => row.stats.offen + row.stats.erledigt > 0);

        const ressortGroups: { key: string; label: string; memberIds: Set<string> }[] = ressorts.map((r) => ({
          key: `ressort:${r.id}`,
          label: r.name,
          memberIds: new Set(ressortMembers.filter((m) => m.ressortId === r.id).map((m) => m.userId)),
        }));
        const withoutRessort = new Set(ressortMembers.filter((m) => m.ressortId === null).map((m) => m.userId));
        if (withoutRessort.size > 0) {
          ressortGroups.push({ key: 'ressort:none', label: 'Ohne Ressort', memberIds: withoutRessort });
        }
        const ressortRows: StatsRow[] = ressortGroups.map((g) => {
          const groupTasks = vorstandTasks.filter((t) => g.memberIds.has(t.assigned_to));
          return { key: g.key, label: g.label, stats: computeTaskStats(groupTasks), tasks: groupTasks };
        });

        setViews({
          sport: { groupRows: teamRows, personRows: buildPersonRows(sportTasks, 'sport') },
          vorstand: { groupRows: ressortRows, personRows: buildPersonRows(vorstandTasks, 'vorstand') },
        });
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

  const current = TABS.find((t) => t.key === tab)!;
  const view = views?.[tab];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-text">Aufgaben · Übersicht Sport/Vorstand</h1>
        <BackLinkButton to="/aufgaben">Zurück zu Aufgaben</BackLinkButton>
      </div>

      <div role="tablist" aria-label="Bereich" className="inline-flex gap-1 self-start rounded-md border border-border bg-surface-alt p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              setExpanded(null);
            }}
            className={clsx(
              'rounded px-4 py-1.5 text-sm font-semibold transition-colors',
              tab === t.key ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {views === null && !error && <p className="text-sm text-text-muted">Lädt…</p>}

      {view && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-text-muted">{current.groupTitle}</h2>
          {view.groupRows.length === 0 && (
            <Card>
              <p className="text-sm text-text-muted">{current.empty}</p>
            </Card>
          )}
          {view.groupRows.map((row) => renderRow(row, true))}
        </div>
      )}

      {view && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-text-muted">Nach Person</h2>
          {view.personRows.length === 0 && (
            <Card>
              <p className="text-sm text-text-muted">Niemandem sind {current.label}-Aufgaben zugeteilt.</p>
            </Card>
          )}
          {view.personRows.map((row) => renderRow(row, false))}
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
