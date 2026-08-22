import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { Select } from '../../components/Select';
import { useAuth } from '../../auth/AuthContext';
import { todayIso } from '../../lib/dates';
import {
  createTasks,
  fetchTaskRecipientOptions,
  fetchTaskTeamOptions,
  uploadTaskAttachment,
} from './api';
import type { TeamOptionForTask, UserOptionForTask } from './api';

type RecipientMode = 'user' | 'team_coaches' | 'all_headcoaches' | 'all_coaches' | 'all_users';

const RECIPIENT_MODE_LABELS: Record<RecipientMode, string> = {
  user: 'Einzelne Person',
  team_coaches: 'Alle Coaches eines Teams',
  all_headcoaches: 'Alle Headcoaches',
  all_coaches: 'Alle Coaches',
  all_users: 'Alle User',
};

interface CreateTaskDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTaskDialog({ onClose, onCreated }: CreateTaskDialogProps) {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(todayIso());
  const [file, setFile] = useState<File | null>(null);
  const [isTeamTask, setIsTeamTask] = useState(false);

  const [recipientMode, setRecipientMode] = useState<RecipientMode>('user');
  const [users, setUsers] = useState<UserOptionForTask[]>([]);
  const [teams, setTeams] = useState<TeamOptionForTask[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchTaskRecipientOptions('all_users'), fetchTaskTeamOptions()])
      .then(([userOptions, teamOptions]) => {
        setUsers(userOptions);
        setTeams(teamOptions);
        if (userOptions.length > 0) setSelectedUserId(userOptions[0].userId);
        if (teamOptions.length > 0) setSelectedTeamId(teamOptions[0].teamId);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Empfänger konnten nicht geladen werden.'));
  }, []);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
  }

  async function resolveRecipientIds(): Promise<string[]> {
    if (recipientMode === 'user') {
      return selectedUserId ? [selectedUserId] : [];
    }
    if (recipientMode === 'team_coaches') {
      if (!selectedTeamId) return [];
      const options = await fetchTaskRecipientOptions('team_coaches', selectedTeamId);
      return options.map((o) => o.userId);
    }
    const options = await fetchTaskRecipientOptions(recipientMode);
    return options.map((o) => o.userId);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    setLoading(true);
    try {
      const recipientUserIds = await resolveRecipientIds();
      if (recipientUserIds.length === 0) {
        throw new Error('Es wurde kein gültiger Empfänger gefunden.');
      }
      const attachment_path = file ? await uploadTaskAttachment(file) : null;
      await createTasks({
        title,
        description: description || null,
        due_date: dueDate,
        attachment_path,
        is_team_task: recipientUserIds.length > 1 && isTeamTask,
        created_by: profile.id,
        recipientUserIds,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aufgabe konnte nicht erstellt werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Neue Aufgabe"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="create-task-form" disabled={loading}>
            {loading ? 'Erstellen…' : 'Aufgabe erstellen'}
          </Button>
        </>
      }
    >
      <form id="create-task-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="title">Titel</Label>
          <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="description">Beschrieb (optional)</Label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <Label htmlFor="dueDate">Fälligkeitsdatum</Label>
          <Input id="dueDate" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="attachment">Datei/Foto (optional, max. 20 MB)</Label>
          <input
            id="attachment"
            type="file"
            onChange={handleFile}
            className="block w-full text-sm text-text file:mr-3 file:rounded-xl file:border-0 file:bg-surface-alt file:px-3.5 file:py-2.5 file:text-sm file:font-medium file:text-text"
          />
        </div>

        <div>
          <Label>Erfasser</Label>
          <p className="text-sm text-text-muted">
            {profile ? `${profile.first_name} ${profile.last_name}` : '—'}
          </p>
        </div>

        <div>
          <Label htmlFor="recipientMode">Empfänger</Label>
          <Select
            id="recipientMode"
            value={recipientMode}
            onChange={(e) => setRecipientMode(e.target.value as RecipientMode)}
          >
            {(Object.keys(RECIPIENT_MODE_LABELS) as RecipientMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {RECIPIENT_MODE_LABELS[mode]}
              </option>
            ))}
          </Select>
        </div>

        {recipientMode === 'user' && (
          <div>
            <Label htmlFor="recipientUser">Person</Label>
            <Select id="recipientUser" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.lastName} {u.firstName}
                </option>
              ))}
            </Select>
          </div>
        )}

        {recipientMode === 'team_coaches' && (
          <div>
            <Label htmlFor="recipientTeam">Team</Label>
            <Select id="recipientTeam" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
              {teams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.categoryName} · {t.teamName} ({t.season})
                </option>
              ))}
            </Select>
          </div>
        )}

        {recipientMode !== 'user' && (
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              className="size-5"
              checked={isTeamTask}
              onChange={(e) => setIsTeamTask(e.target.checked)}
            />
            Teamaufgabe (eine Erledigung zählt für alle Empfänger)
          </label>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
