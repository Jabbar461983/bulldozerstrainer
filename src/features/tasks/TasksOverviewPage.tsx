import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/Card';
import { deriveTaskStatus, fetchAllTasks, TASK_STATUS_LABELS } from './api';
import type { TaskRow } from './api';
import { TaskDetailDialog } from './TaskDetailDialog';

function formatDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function TasksOverviewPage() {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);

  async function load() {
    setError(null);
    try {
      setTasks(await fetchAllTasks());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Übersicht konnte nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">Aufgaben · Gesamtübersicht</h1>
        <Link to="/aufgaben" className="text-sm font-medium text-accent hover:underline">
          Zurück zu Aufgaben
        </Link>
      </div>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {tasks === null && !error && <p className="text-sm text-text-muted">Lädt…</p>}
      {tasks?.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Noch keine Aufgaben erfasst.</p>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {tasks?.map((t) => {
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
