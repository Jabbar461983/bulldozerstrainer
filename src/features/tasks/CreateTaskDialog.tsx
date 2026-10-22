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
  createTaskSeries,
  fetchRessorts,
  fetchTaskPersonRoles,
  fetchTaskRecipientOptions,
  fetchTaskTeamOptions,
  TASK_CATEGORY_LABELS,
  TASK_RECURRENCE_LABELS,
  uploadTaskAttachment,
} from './api';
import type { TaskCategory, TaskRecurrence, VorstandRessort } from '../../types/database';
import { TaskCategoryBadge } from './TaskCategoryBadge';
import type { TeamOptionForTask, UserOptionForTask } from './api';

type RecipientMode =
  | 'user'
  | 'team_coaches'
  | 'all_headcoaches'
  | 'all_coaches'
  | 'vorstand_all'
  | 'vorstand_ressort'
  | 'all_users';

const RECIPIENT_MODE_LABELS: Record<RecipientMode, string> = {
  user: 'Einzelne Person',
  team_coaches: 'Alle Coaches eines Teams',
  all_headcoaches: 'Alle Headcoaches',
  all_coaches: 'Alle Coaches',
  vorstand_all: 'Vorstand (alle)',
  vorstand_ressort: 'Vorstand-Ressort',
  all_users: 'Alle User',
};

/**
 * Zuordnung Sport/Vorstand:
 * - "Vorstand (alle)" und "Vorstand-Ressort" -> Vorstand, alle anderen Gruppen -> Sport
 * - Einzelperson: nur Vorstand -> Vorstand, nur Sport-Rollen (oder keine) -> Sport,
 *   beides -> der Ersteller wird gefragt.
 */
type PersonRoles = { isVorstand: boolean; hasSportRole: boolean } | null;

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
  // Wiederholung: '' = einmalige Aufgabe
  const [recurrence, setRecurrence] = useState<TaskRecurrence | ''>('');
  const [endDate, setEndDate] = useState('');

  const [recipientMode, setRecipientMode] = useState<RecipientMode>('user');
  const [users, setUsers] = useState<UserOptionForTask[]>([]);
  const [teams, setTeams] = useState<TeamOptionForTask[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [ressorts, setRessorts] = useState<VorstandRessort[]>([]);
  const [selectedRessortId, setSelectedRessortId] = useState('');

  const [personRoles, setPersonRoles] = useState<PersonRoles>(null);
  const [chosenCategory, setChosenCategory] = useState<TaskCategory | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (recipientMode !== 'user' || !selectedUserId) return;
    let active = true;
    setPersonRoles(null);
    setChosenCategory(null);
    fetchTaskPersonRoles(selectedUserId)
      .then((roles) => {
        if (active) setPersonRoles(roles);
      })
      .catch(() => {
        if (active) setPersonRoles({ isVorstand: false, hasSportRole: true });
      });
    return () => {
      active = false;
    };
  }, [recipientMode, selectedUserId]);

  const needsCategoryChoice =
    recipientMode === 'user' && Boolean(personRoles?.isVorstand && personRoles?.hasSportRole);

  function resolveCategory(): TaskCategory | null {
    if (recipientMode === 'vorstand_all' || recipientMode === 'vorstand_ressort') return 'vorstand';
    if (recipientMode !== 'user') return 'sport';
    if (!personRoles) return null;
    if (needsCategoryChoice) return chosenCategory;
    return personRoles.isVorstand ? 'vorstand' : 'sport';
  }

  const category = resolveCategory();

  useEffect(() => {
    Promise.all([fetchTaskRecipientOptions('all_users'), fetchTaskTeamOptions(), fetchRessorts()])
      .then(([userOptions, teamOptions, ressortOptions]) => {
        setUsers(userOptions);
        setTeams(teamOptions);
        setRessorts(ressortOptions);
        if (ressortOptions.length > 0) setSelectedRessortId(ressortOptions[0].id);
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
    if (recipientMode === 'vorstand_ressort') {
      if (!selectedRessortId) return [];
      const options = await fetchTaskRecipientOptions('vorstand_ressort', undefined, selectedRessortId);
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
      if (!category) {
        throw new Error('Bitte wähle aus, ob es eine Vorstands- oder eine Sport-Aufgabe ist.');
      }
      const recipientUserIds = await resolveRecipientIds();
      if (recipientUserIds.length === 0) {
        throw new Error('Es wurde kein gültiger Empfänger gefunden.');
      }
      if (recurrence && endDate && endDate < dueDate) {
        throw new Error('Das Enddatum der Serie liegt vor dem ersten Termin.');
      }
      const attachment_path = file ? await uploadTaskAttachment(file) : null;
      const payload = {
        title,
        description: description || null,
        due_date: dueDate,
        attachment_path,
        is_team_task: recipientUserIds.length > 1 && isTeamTask,
        category,
        created_by: profile.id,
        recipientUserIds,
      };
      if (recurrence) {
        await createTaskSeries({ ...payload, recurrence, end_date: endDate || null });
      } else {
        await createTasks(payload);
      }
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
          <Button type="submit" form="create-task-form" disabled={loading || !category}>
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
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-text outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15"
          />
        </div>
        <div>
          <Label htmlFor="dueDate">Fälligkeitsdatum</Label>
          <Input id="dueDate" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          {recurrence && <p className="mt-1 text-xs text-text-muted">Erster Termin der Serie.</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="recurrence">Wiederholung</Label>
            <Select
              id="recurrence"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as TaskRecurrence | '')}
            >
              <option value="">Einmalig</option>
              {(Object.keys(TASK_RECURRENCE_LABELS) as TaskRecurrence[]).map((r) => (
                <option key={r} value={r}>
                  {TASK_RECURRENCE_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
          {recurrence && (
            <div>
              <Label htmlFor="seriesEndDate">Enddatum (optional)</Label>
              <Input
                id="seriesEndDate"
                type="date"
                min={dueDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}
        </div>
        {recurrence && !endDate && (
          <p className="-mt-2 text-xs text-text-muted">
            Ohne Enddatum läuft die Serie weiter; die Termine werden laufend 12 Monate im Voraus angelegt.
          </p>
        )}
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

        {recipientMode === 'vorstand_ressort' && (
          <div>
            <Label htmlFor="recipientRessort">Ressort</Label>
            <Select id="recipientRessort" value={selectedRessortId} onChange={(e) => setSelectedRessortId(e.target.value)}>
              {ressorts.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {needsCategoryChoice ? (
          <fieldset className="flex flex-col gap-2 rounded-md border border-gold/60 bg-gold/10 p-3">
            <legend className="px-1 text-sm font-semibold text-text">Aufgabe zuordnen</legend>
            <p className="text-sm text-text-muted">
              Diese Person hat die Rolle Vorstand und eine Rolle im Sport. Ist das eine Vorstands- oder eine
              Sport-Aufgabe?
            </p>
            <div className="flex flex-wrap gap-4">
              {(['vorstand', 'sport'] as TaskCategory[]).map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm font-medium text-text">
                  <input
                    type="radio"
                    name="task-category"
                    className="size-5 accent-[var(--club-accent)]"
                    checked={chosenCategory === c}
                    onChange={() => setChosenCategory(c)}
                  />
                  {TASK_CATEGORY_LABELS[c]}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          category && (
            <p className="flex items-center gap-2 text-sm text-text-muted">
              Zuordnung: <TaskCategoryBadge category={category} />
            </p>
          )
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
