import { TaskCategoryBadge } from './TaskCategoryBadge';
import { useEffect, useState } from 'react';
import { List, ListRow } from '../../components/List';
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
      <List>
        {tasks.map((t) => {
          const overdue = t.due_date < todayIso;
          return (
            <ListRow key={t.id} onClick={() => setSelectedTask(t)} className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 flex-wrap items-center gap-2 font-medium text-text">
                {t.title}
                <TaskCategoryBadge category={t.category} />
              </p>
              <span className={`text-sm ${overdue ? 'font-medium text-danger' : 'text-text-muted'}`}>
                {formatDate(t.due_date)}
              </span>
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
