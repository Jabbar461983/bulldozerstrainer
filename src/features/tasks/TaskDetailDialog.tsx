import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { useAuth } from '../../auth/AuthContext';
import {
  deleteTaskGroup,
  deriveTaskStatus,
  TASK_STATUS_LABELS,
  updateTaskCompletion,
  updateTaskGroupContent,
  uploadTaskAttachment,
} from './api';
import type { TaskRow } from './api';

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
  const [newFile, setNewFile] = useState<File | null>(null);
  const [savingContent, setSavingContent] = useState(false);

  const [completed, setCompleted] = useState(task.completed);
  const [remark, setRemark] = useState(task.remark ?? '');
  const [savingStatus, setSavingStatus] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    setNewFile(e.target.files?.[0] ?? null);
  }

  async function handleSaveContent(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavingContent(true);
    try {
      const attachment_path = newFile ? await uploadTaskAttachment(newFile) : task.attachment_path;
      await updateTaskGroupContent(task.task_group_id, {
        title,
        description: description || null,
        due_date: dueDate,
        attachment_path,
        is_team_task: isTeamTask,
      });
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

  async function handleDelete() {
    const confirmed = window.confirm(
      'Diese Aufgabe wirklich unwiderruflich löschen? Falls sie an mehrere Personen gerichtet ist, wird sie bei allen gelöscht.',
    );
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteTaskGroup(task.task_group_id);
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
            <Button type="button" variant="danger" disabled={deleting} onClick={() => void handleDelete()}>
              Löschen
            </Button>
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
        <form id="task-content-form" onSubmit={handleSaveContent} className="flex flex-col gap-4">
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
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
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
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
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

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
