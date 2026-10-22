import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { Select } from '../../components/Select';
import { useAuth } from '../../auth/AuthContext';
import {
  deleteOpenTasksOfSeries,
  deleteTaskGroup,
  deriveTaskStatus,
  fetchTaskRecipientOptions,
  forwardTask,
  TASK_CATEGORY_LABELS,
  TASK_STATUS_LABELS,
  updateTaskCompletion,
  updateTaskGroupContent,
  updateTaskSeriesContent,
  uploadTaskAttachment,
} from './api';
import type { TaskRow, UserOptionForTask } from './api';
import type { TaskCategory } from '../../types/database';
import { TaskCategoryBadge } from './TaskCategoryBadge';
import { SeriesIcon, seriesDescription } from './SeriesIcon';

type SeriesScope = 'single' | 'series';

interface TaskDetailDialogProps {
  task: TaskRow;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}

export function TaskDetailDialog({ task, onClose, onChanged, onDeleted }: TaskDetailDialogProps) {
  const { profile, isAdmin } = useAuth();
  const canEditContent = isAdmin || task.created_by === profile?.id;
  const isOwnRow = task.assigned_to === profile?.id;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [dueDate, setDueDate] = useState(task.due_date);
  const [isTeamTask, setIsTeamTask] = useState(task.is_team_task);
  const [category, setCategory] = useState<TaskCategory>(task.category ?? 'sport');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [savingContent, setSavingContent] = useState(false);

  const [completed, setCompleted] = useState(task.completed);
  const [remark, setRemark] = useState(task.remark ?? '');
  const [savingStatus, setSavingStatus] = useState(false);

  const [deleting, setDeleting] = useState(false);
  // Serienaufgabe: Rückfrage "nur dieser Termin oder ganze Serie?"
  const [seriesQuestion, setSeriesQuestion] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canForward = !task.completed && (isOwnRow || canEditContent);
  const [showForward, setShowForward] = useState(false);
  const [forwardOptions, setForwardOptions] = useState<UserOptionForTask[] | null>(null);
  const [forwardTo, setForwardTo] = useState('');
  const [forwarding, setForwarding] = useState(false);

  useEffect(() => {
    if (!showForward || forwardOptions !== null) return;
    fetchTaskRecipientOptions('all_users')
      .then((users) => setForwardOptions(users.filter((u) => u.userId !== task.assigned_to)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Benutzer konnten nicht geladen werden.'));
  }, [showForward, forwardOptions, task.assigned_to]);

  async function handleForward() {
    if (!forwardTo) return;
    const target = forwardOptions?.find((u) => u.userId === forwardTo);
    const confirmed = window.confirm(
      `Aufgabe an ${target ? `${target.firstName} ${target.lastName}` : 'diese Person'} weiterleiten?` +
        (isOwnRow ? ' Sie verschwindet danach aus deiner Liste.' : ''),
    );
    if (!confirmed) return;
    setError(null);
    setForwarding(true);
    try {
      await forwardTask(task.id, forwardTo);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aufgabe konnte nicht weitergeleitet werden.');
    } finally {
      setForwarding(false);
    }
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    setNewFile(e.target.files?.[0] ?? null);
  }

  function handleSubmitContent(e: FormEvent) {
    e.preventDefault();
    if (task.series) {
      setSeriesQuestion('save');
      return;
    }
    void saveContent('single');
  }

  async function saveContent(scope: SeriesScope) {
    setSeriesQuestion(null);
    setError(null);
    setSavingContent(true);
    try {
      const attachment_path = newFile ? await uploadTaskAttachment(newFile) : task.attachment_path;
      const content = {
        title,
        description: description || null,
        attachment_path,
        is_team_task: isTeamTask,
        category,
      };
      // Das Fälligkeitsdatum gilt immer nur für diesen Termin.
      await updateTaskGroupContent(task.task_group_id, { ...content, due_date: dueDate });
      if (scope === 'series' && task.series) {
        await updateTaskSeriesContent(task.series.id, content);
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aufgabe konnte nicht gespeichert werden.');
    } finally {
      setSavingContent(false);
    }
  }

  async function handleSaveStatus() {
    setError(null);
    setSavingStatus(true);
    try {
      await updateTaskCompletion(task.id, completed, remark || null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status konnte nicht gespeichert werden.');
    } finally {
      setSavingStatus(false);
    }
  }

  function handleDelete() {
    if (task.series) {
      setSeriesQuestion('delete');
      return;
    }
    const confirmed = window.confirm(
      'Diese Aufgabe wirklich unwiderruflich löschen? Falls sie an mehrere Personen gerichtet ist, wird sie bei allen gelöscht.',
    );
    if (!confirmed) return;
    void deleteTasks('single');
  }

  async function deleteTasks(scope: SeriesScope) {
    setSeriesQuestion(null);
    setDeleting(true);
    setError(null);
    try {
      if (scope === 'series' && task.series) {
        await deleteOpenTasksOfSeries(task.series.id);
      } else {
        await deleteTaskGroup(task.task_group_id);
      }
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aufgabe konnte nicht gelöscht werden.');
    } finally {
      setDeleting(false);
    }
  }

  const status = deriveTaskStatus(task);

  return (
    <Modal
      title="Aufgabe"
      onClose={onClose}
      footer={
        canEditContent ? (
          <>
            {/* Löschen ist ein Admin-Sonderrecht. */}
            {isAdmin && (
              <Button type="button" variant="danger" disabled={deleting} onClick={handleDelete}>
                Löschen
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={onClose}>
              Schliessen
            </Button>
            <Button type="submit" form="task-content-form" disabled={savingContent}>
              {savingContent ? 'Speichern…' : 'Speichern'}
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={onClose}>
            Schliessen
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <form id="task-content-form" onSubmit={handleSubmitContent} className="flex flex-col gap-4">
          {task.series && (
            <p className="flex items-center gap-2 rounded-md bg-surface-alt px-3 py-2 text-sm text-text-muted">
              <SeriesIcon series={task.series} />
              {seriesDescription(task.series)}
            </p>
          )}
          {canEditContent ? (
            <>
              <div>
                <Label htmlFor="edit-title">Titel</Label>
                <Input id="edit-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edit-description">Beschrieb</Label>
                <textarea
                  id="edit-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-text outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15"
                />
              </div>
              <div>
                <Label htmlFor="edit-category">Zuordnung</Label>
                <Select id="edit-category" value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)}>
                  <option value="sport">{TASK_CATEGORY_LABELS.sport}</option>
                  <option value="vorstand">{TASK_CATEGORY_LABELS.vorstand}</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-due-date">Fälligkeitsdatum</Label>
                <Input
                  id="edit-due-date"
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-attachment">
                  Datei/Foto {task.attachmentUrl && '(ersetzen, optional)'}
                </Label>
                {task.attachmentUrl && !newFile && (
                  <a
                    href={task.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-1.5 block text-sm text-accent hover:underline"
                  >
                    Aktuellen Anhang ansehen
                  </a>
                )}
                <input
                  id="edit-attachment"
                  type="file"
                  onChange={handleFile}
                  className="block w-full text-sm text-text file:mr-3 file:rounded-xl file:border-0 file:bg-surface-alt file:px-3.5 file:py-2.5 file:text-sm file:font-medium file:text-text"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={isTeamTask}
                  onChange={(e) => setIsTeamTask(e.target.checked)}
                />
                Teamaufgabe (eine Erledigung zählt für alle Empfänger)
              </label>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs text-text-muted">Titel</p>
                <p className="font-medium text-text">{task.title}</p>
              </div>
              {task.description && (
                <div>
                  <p className="text-xs text-text-muted">Beschrieb</p>
                  <p className="text-text">{task.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-text-muted">Zuordnung</p>
                <TaskCategoryBadge category={task.category ?? 'sport'} />
              </div>
              <div>
                <p className="text-xs text-text-muted">Fälligkeitsdatum</p>
                <p className="text-text">
                  {new Date(`${task.due_date}T00:00:00`).toLocaleDateString('de-CH')}
                </p>
              </div>
              {task.attachmentUrl && (
                <a href={task.attachmentUrl} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">
                  Anhang ansehen
                </a>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
            <div>
              <p className="text-xs text-text-muted">Erfasser</p>
              <p className="text-text">{task.creatorName}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Empfänger</p>
              <p className="text-text">{task.assigneeName}</p>
            </div>
          </div>

          {task.forwards.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl bg-surface-alt p-3 text-sm">
              {task.forwards.map((f, i) => (
                <p key={i} className="text-text-muted">
                  ↪ Von <span className="font-medium text-text">{f.fromName}</span> weitergeleitet an{' '}
                  <span className="font-medium text-text">{f.toName}</span>
                  {' · '}
                  {new Date(f.createdAt).toLocaleDateString('de-CH')}
                </p>
              ))}
            </div>
          )}
        </form>

        <div className="border-t border-border pt-4">
          <Label>Status: {TASK_STATUS_LABELS[status]}</Label>
          {isOwnRow ? (
            <div className="flex flex-col gap-3">
              <div>
                <Label htmlFor="remark">Bemerkung</Label>
                <textarea
                  id="remark"
                  rows={2}
                  placeholder="z.B. Stand, Verzögerung…"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-text outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={completed}
                  onChange={(e) => setCompleted(e.target.checked)}
                />
                Aufgabe erledigt
              </label>
              <Button type="button" disabled={savingStatus} onClick={() => void handleSaveStatus()} className="self-start">
                {savingStatus ? 'Speichern…' : 'Status speichern'}
              </Button>
            </div>
          ) : (
            task.remark && <p className="mt-1 text-sm text-text-muted">{task.remark}</p>
          )}
        </div>

        {canForward && (
          <div className="border-t border-border pt-4">
            {!showForward ? (
              <Button type="button" variant="secondary" onClick={() => setShowForward(true)}>
                Weiterleiten
              </Button>
            ) : (
              <div className="flex flex-col gap-3">
                <Label htmlFor="forward-to">Weiterleiten an</Label>
                {forwardOptions === null ? (
                  <p className="text-sm text-text-muted">Lädt…</p>
                ) : (
                  <Select id="forward-to" value={forwardTo} onChange={(e) => setForwardTo(e.target.value)}>
                    <option value="">– Person wählen –</option>
                    {forwardOptions.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </Select>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setShowForward(false)}>
                    Abbrechen
                  </Button>
                  <Button type="button" disabled={!forwardTo || forwarding} onClick={() => void handleForward()}>
                    {forwarding ? 'Weiterleiten…' : 'Weiterleiten'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      {seriesQuestion && (
        <Modal
          title={seriesQuestion === 'delete' ? 'Serienaufgabe löschen' : 'Serienaufgabe ändern'}
          onClose={() => setSeriesQuestion(null)}
          footer={
            <Button type="button" variant="secondary" onClick={() => setSeriesQuestion(null)}>
              Abbrechen
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text">
              {seriesQuestion === 'delete'
                ? 'Diese Aufgabe gehört zu einer Serie. Was möchtest du löschen?'
                : 'Diese Aufgabe gehört zu einer Serie. Wofür sollen die Änderungen gelten?'}
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void (seriesQuestion === 'delete' ? deleteTasks('single') : saveContent('single'))}
            >
              {seriesQuestion === 'delete' ? 'Nur diese Aufgabe löschen' : 'Nur diese Aufgabe ändern'}
            </Button>
            <Button
              type="button"
              variant={seriesQuestion === 'delete' ? 'danger' : 'primary'}
              onClick={() => void (seriesQuestion === 'delete' ? deleteTasks('series') : saveContent('series'))}
            >
              {seriesQuestion === 'delete'
                ? 'Alle Aufgaben dieser Serie löschen'
                : 'Alle offenen Aufgaben dieser Serie ändern'}
            </Button>
            <p className="text-xs text-text-muted">
              {seriesQuestion === 'delete'
                ? 'Bereits erledigte Aufgaben der Serie bleiben erhalten; es entstehen keine neuen Termine mehr.'
                : 'Erledigte Aufgaben bleiben unverändert. Das Fälligkeitsdatum ändert sich nur bei dieser Aufgabe.'}
            </p>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
