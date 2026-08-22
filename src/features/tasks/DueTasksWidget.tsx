import { useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import { fetchMyDueTasks } from './api';
import type { TaskRow } from './api';
import { TaskDetailDialog } from './TaskDetailDialog';

const MAX_DUE_TASKS = 5;

function formatDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function DueTasksWidget() {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);

  async function load() {
    try {
      setTasks(await fetchMyDueTasks(MAX_DUE_TASKS));
    } catch {
      setTasks([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (tasks === null || tasks.length === 0) return null;

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-text-muted">Fällige Aufgaben</h2>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => {
          const overdue = t.due_date < todayIso;
          return (
            <Card
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedTask(t)}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedTask(t)}
              className="flex cursor-pointer items-center justify-between gap-2 py-3"
            >
              <p className="font-medium text-text">{t.title}</p>
              <span className={`text-sm ${overdue ? 'font-medium text-danger' : 'text-text-muted'}`}>
                {formatDate(t.due_date)}
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
