import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useAuth } from '../../auth/AuthContext';
import { deriveTaskStatus, fetchMyTasks, fetchTasksCreatedByMe, TASK_STATUS_LABELS } from './api';
import type { TaskRow } from './api';
import { CreateTaskDialog } from './CreateTaskDialog';
import { TaskDetailDialog } from './TaskDetailDialog';

type Tab = 'mine' | 'created';

function formatDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: ReturnType<typeof deriveTaskStatus> }) {
  const styles: Record<string, string> = {
    offen: 'bg-surface-alt text-text-muted',
    in_arbeit: 'bg-warning/10 text-warning',
    erledigt: 'bg-success/10 text-success',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

export function TasksPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('mine');
  const [myTasks, setMyTasks] = useState<TaskRow[] | null>(null);
  const [createdTasks, setCreatedTasks] = useState<TaskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);

  async function load() {
    setError(null);
    try {
      const [mine, created] = await Promise.all([fetchMyTasks(), fetchTasksCreatedByMe()]);
      setMyTasks(mine);
      setCreatedTasks(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aufgaben konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const createdGroups = useMemo(() => {
    const groups = new Map<string, TaskRow[]>();
    for (const t of createdTasks ?? []) {
      const list = groups.get(t.task_group_id) ?? [];
      list.push(t);
      groups.set(t.task_group_id, list);
    }
    return Array.from(groups.values());
  }, [createdTasks]);

  function handleChanged() {
    setSelectedTask(null);
    void load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">Aufgaben</h1>
        <div className="flex gap-2">
          {isAdmin && (
            <Link to="/aufgaben/uebersicht">
              <Button variant="secondary">Gesamtübersicht</Button>
            </Link>
          )}
          <Button onClick={() => setShowCreate(true)}>+ Neue Aufgabe</Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === 'mine' ? 'primary' : 'secondary'} onClick={() => setTab('mine')}>
          Mir zugewiesen
        </Button>
        <Button variant={tab === 'created' ? 'primary' : 'secondary'} onClick={() => setTab('created')}>
          Von mir erstellt
        </Button>
      </div>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      {tab === 'mine' && (
        <div className="flex flex-col gap-2">
          {myTasks === null && <p className="text-sm text-text-muted">Lädt…</p>}
          {myTasks?.length === 0 && (
            <Card>
              <p className="text-sm text-text-muted">Dir sind keine Aufgaben zugeteilt.</p>
            </Card>
          )}
          {myTasks?.map((t) => {
            const status = deriveTaskStatus(t);
            return (
              <Card
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedTask(t)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedTask(t)}
                className="cursor-pointer"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-text">{t.title}</p>
                    <p className="text-sm text-text-muted">
                      Fällig: {formatDate(t.due_date)} · von {t.creatorName}
                    </p>
                  </div>
                  <StatusBadge status={status} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'created' && (
        <div className="flex flex-col gap-3">
          {createdTasks === null && <p className="text-sm text-text-muted">Lädt…</p>}
          {createdTasks?.length === 0 && (
            <Card>
              <p className="text-sm text-text-muted">Du hast noch keine Aufgaben erstellt.</p>
            </Card>
          )}
          {createdGroups.map((group) => {
            const first = group[0];
            return (
              <Card key={first.task_group_id}>
                <p className="font-medium text-text">{first.title}</p>
                <p className="text-sm text-text-muted">
                  Fällig: {formatDate(first.due_date)}
                  {first.is_team_task && ' · Teamaufgabe'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {group.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTask(t)}
                      className="flex items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-1 text-xs text-text-muted hover:bg-surface"
                    >
                      {t.assigneeName}
                      <StatusBadge status={deriveTaskStatus(t)} />
                    </button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateTaskDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onChanged={handleChanged}
          onDeleted={handleChanged}
        />
      )}
    </div>
  );
}
