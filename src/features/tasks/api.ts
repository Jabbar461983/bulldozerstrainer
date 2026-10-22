import { supabase } from '../../lib/supabase';
import { todayIso } from '../../lib/dates';
import type { Task, TaskCategory, TaskRecurrence, TaskSeries } from '../../types/database';

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  sport: 'Sport',
  vorstand: 'Vorstand',
};

export const TASK_RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  weekly: 'Wöchentlich',
  biweekly: '14-täglich',
  monthly: 'Monatlich',
  quarterly: 'Quartalsweise',
  halfyearly: 'Halbjährlich',
  yearly: 'Jährlich',
};

const ATTACHMENTS_BUCKET = 'task-attachments';
const SIGNED_URL_TTL_SECONDS = 3600;
export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;

export interface TaskForwardInfo {
  fromName: string;
  toName: string;
  createdAt: string;
}

export interface TaskRow extends Task {
  creatorName: string;
  assigneeName: string;
  attachmentUrl: string | null;
  /** Weiterleitungen, älteste zuerst. */
  forwards: TaskForwardInfo[];
  /** Serie, zu der dieser Termin gehört (sonst null). */
  series: TaskSeries | null;
}

export type TaskStatus = 'offen' | 'in_arbeit' | 'erledigt';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  offen: 'Offen',
  in_arbeit: 'In Arbeit',
  erledigt: 'Erledigt',
};

export function deriveTaskStatus(task: Pick<Task, 'completed' | 'remark'>): TaskStatus {
  if (task.completed) return 'erledigt';
  if (task.remark && task.remark.trim() !== '') return 'in_arbeit';
  return 'offen';
}

const OVERDUE_THRESHOLD_DAYS = 5;

export function isOverdue(dueDate: string): boolean {
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > OVERDUE_THRESHOLD_DAYS;
}

export interface TaskStats {
  offen: number;
  erledigt: number;
  ueberfaellig: number;
}

/** "Überfällig" zählt zusätzlich als "offen" (mehr als 5 Tage im Verzug). */
export function computeTaskStats(tasks: Pick<Task, 'completed' | 'due_date'>[]): TaskStats {
  let offen = 0;
  let erledigt = 0;
  let ueberfaellig = 0;
  for (const t of tasks) {
    if (t.completed) {
      erledigt++;
    } else {
      offen++;
      if (isOverdue(t.due_date)) ueberfaellig++;
    }
  }
  return { offen, erledigt, ueberfaellig };
}

interface TaskForwardDbRow {
  task_id: string;
  from_user: string | null;
  to_user: string | null;
  created_at: string;
}

async function fetchForwards(taskIds: string[]): Promise<TaskForwardDbRow[]> {
  if (taskIds.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)('task_forwards')
    .select('task_id, from_user, to_user, created_at')
    .in('task_id', taskIds)
    .order('created_at', { ascending: true });
  // Migration 0092 evtl. noch nicht ausgeführt - Aufgaben trotzdem anzeigen.
  if (error) return [];
  return (data ?? []) as TaskForwardDbRow[];
}

async function fetchSeries(seriesIds: string[]): Promise<Map<string, TaskSeries>> {
  const byId = new Map<string, TaskSeries>();
  if (seriesIds.length === 0) return byId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)('task_series')
    .select('id, recurrence, start_date, end_date, active')
    .in('id', seriesIds);
  if (error) return byId;
  for (const s of (data ?? []) as TaskSeries[]) byId.set(s.id, s);
  return byId;
}

/**
 * Serien legen Termine bis zu 12 Monate im Voraus an. In Listen und Zahlen
 * zählen pro Serie und Person nur die fälligen offenen Termine plus der
 * nächste kommende; erledigte bleiben alle sichtbar.
 */
export function hideLaterSeriesOccurrences<T extends Pick<Task, 'series_id' | 'assigned_to' | 'completed' | 'due_date'>>(
  rows: T[],
): T[] {
  const today = todayIso();
  const nextBySeriesPerson = new Map<string, string>();
  for (const r of rows) {
    if (!r.series_id || r.completed || r.due_date <= today) continue;
    const key = `${r.series_id}:${r.assigned_to}`;
    const current = nextBySeriesPerson.get(key);
    if (!current || r.due_date < current) nextBySeriesPerson.set(key, r.due_date);
  }
  return rows.filter(
    (r) =>
      !r.series_id ||
      r.completed ||
      r.due_date <= today ||
      nextBySeriesPerson.get(`${r.series_id}:${r.assigned_to}`) === r.due_date,
  );
}

async function attachRowMeta(rows: Task[]): Promise<TaskRow[]> {
  const [forwardRows, seriesById] = await Promise.all([
    fetchForwards(rows.map((r) => r.id)),
    fetchSeries(Array.from(new Set(rows.map((r) => r.series_id).filter((id): id is string => Boolean(id))))),
  ]);
  const ids = Array.from(
    new Set(
      [
        ...rows.flatMap((r) => [r.created_by, r.assigned_to]),
        ...forwardRows.flatMap((f) => [f.from_user, f.to_user]),
      ].filter((id): id is string => Boolean(id)),
    ),
  );
  const nameById = new Map<string, string>();
  if (ids.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('task_profile_names', { p_ids: ids });
    if (error) throw error;
    for (const p of (data ?? []) as { id: string; first_name: string; last_name: string }[]) {
      nameById.set(p.id, `${p.first_name} ${p.last_name}`);
    }
  }

  const paths = rows.map((r) => r.attachment_path).filter((p): p is string => Boolean(p));
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) urlByPath.set(entry.path, entry.signedUrl);
    }
  }

  const nameOf = (id: string | null) => (id ? (nameById.get(id) ?? 'Unbekannt') : 'Gelöschter Benutzer');
  const forwardsByTask = new Map<string, TaskForwardInfo[]>();
  for (const f of forwardRows) {
    const list = forwardsByTask.get(f.task_id) ?? [];
    list.push({ fromName: nameOf(f.from_user), toName: nameOf(f.to_user), createdAt: f.created_at });
    forwardsByTask.set(f.task_id, list);
  }

  return rows.map((r) => ({
    ...r,
    forwards: forwardsByTask.get(r.id) ?? [],
    series: r.series_id ? (seriesById.get(r.series_id) ?? null) : null,
    creatorName: r.created_by ? (nameById.get(r.created_by) ?? 'Unbekannt') : 'Gelöschter Benutzer',
    assigneeName: nameById.get(r.assigned_to) ?? 'Unbekannt',
    attachmentUrl: r.attachment_path ? (urlByPath.get(r.attachment_path) ?? null) : null,
  }));
}

/** Bis zu `limit` offene, dem Nutzer zugeteilte Aufgaben, nach Fälligkeitsdatum sortiert. */
export async function fetchMyDueTasks(limit: number): Promise<TaskRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', uid)
    .eq('completed', false)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return attachRowMeta(hideLaterSeriesOccurrences((data ?? []) as Task[]).slice(0, limit));
}

/** Alle dem Nutzer zugeteilten Aufgaben (offen zuerst, dann nach Fälligkeitsdatum; erledigte am Schluss). */
export async function fetchMyTasks(): Promise<TaskRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', uid)
    .order('completed', { ascending: true })
    .order('due_date', { ascending: true });
  if (error) throw error;
  return attachRowMeta(hideLaterSeriesOccurrences((data ?? []) as Task[]));
}

/** Alle vom Nutzer erstellten Aufgaben (für die Übersicht "wem was zugeteilt"). */
export async function fetchTasksCreatedByMe(): Promise<TaskRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('created_by', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return attachRowMeta(hideLaterSeriesOccurrences((data ?? []) as Task[]));
}

/**
 * Admin-Gesamtübersicht über alle Aufgaben im System. Spätere Serientermine
 * nur mit `allSeriesOccurrences` (Roadmap).
 */
export async function fetchAllTasks(options: { allSeriesOccurrences?: boolean } = {}): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('due_date', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Task[];
  return attachRowMeta(options.allSeriesOccurrences ? rows : hideLaterSeriesOccurrences(rows));
}

export interface TeamOptionForTask {
  teamId: string;
  teamName: string;
  categoryName: string;
  season: string;
}

export async function fetchTaskTeamOptions(): Promise<TeamOptionForTask[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('task_all_teams');
  if (error) throw error;
  return (data ?? []).map((t: { team_id: string; team_name: string; category_name: string; season: string }) => ({
    teamId: t.team_id,
    teamName: t.team_name,
    categoryName: t.category_name,
    season: t.season,
  }));
}

export interface UserOptionForTask {
  userId: string;
  firstName: string;
  lastName: string;
}

export type TaskRecipientScope =
  | 'team_coaches'
  | 'all_headcoaches'
  | 'all_coaches'
  | 'all_users'
  | 'vorstand_all'
  | 'vorstand_ressort';

export async function fetchTaskRecipientOptions(
  scope: TaskRecipientScope,
  teamId?: string,
  ressortId?: string,
): Promise<UserOptionForTask[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('task_recipients', {
    p_scope: scope,
    p_team_id: teamId ?? null,
    p_ressort_id: ressortId ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((u: { user_id: string; first_name: string; last_name: string }) => ({
    userId: u.user_id,
    firstName: u.first_name,
    lastName: u.last_name,
  }));
}

/** Ressort-Zugehörigkeit der Vorstandsmitglieder (ressortId null = ohne Ressort). */
export async function fetchRessortMembers(): Promise<{ ressortId: string | null; userId: string }[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('task_ressort_members');
  if (error) throw error;
  return ((data ?? []) as { ressort_id: string | null; user_id: string }[]).map((r) => ({
    ressortId: r.ressort_id,
    userId: r.user_id,
  }));
}

export { fetchRessorts } from '../roles/api';

export async function uploadTaskAttachment(file: File): Promise<string> {
  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error(`Datei "${file.name}" ist zu gross (max. 20 MB).`);
  }
  const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined;
  const path = `${crypto.randomUUID()}${extension ? `.${extension}` : ''}`;
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}

export interface CreateTaskPayload {
  title: string;
  description: string | null;
  due_date: string;
  attachment_path: string | null;
  is_team_task: boolean;
  category: TaskCategory;
  created_by: string;
  recipientUserIds: string[];
}

export async function createTasks(payload: CreateTaskPayload) {
  const taskGroupId = crypto.randomUUID();
  const rows = payload.recipientUserIds.map((assignedTo) => ({
    task_group_id: taskGroupId,
    title: payload.title,
    description: payload.description,
    due_date: payload.due_date,
    attachment_path: payload.attachment_path,
    is_team_task: payload.is_team_task,
    category: payload.category,
    created_by: payload.created_by,
    assigned_to: assignedTo,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('tasks') as any).insert(rows);
  if (error) throw error;
}

export interface CreateTaskSeriesPayload extends CreateTaskPayload {
  recurrence: TaskRecurrence;
  end_date: string | null;
}

/** Serie anlegen; die Termine erzeugt die Datenbank (extend_task_series). */
export async function createTaskSeries(payload: CreateTaskSeriesPayload) {
  const seriesId = crypto.randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)('task_series').insert({
    id: seriesId,
    recurrence: payload.recurrence,
    start_date: payload.due_date,
    end_date: payload.end_date,
    title: payload.title,
    description: payload.description,
    attachment_path: payload.attachment_path,
    is_team_task: payload.is_team_task,
    category: payload.category,
    recipients: payload.recipientUserIds,
    created_by: payload.created_by,
  });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: extendError } = await (supabase.rpc as any)('extend_task_series', { p_series_id: seriesId });
  if (extendError) throw extendError;
}

/** Ergänzt laufende Serien ohne Enddatum (beim Start der App). Fehler werden ignoriert. */
export async function extendTaskSeries() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.rpc as any)('extend_task_series', {});
  } catch {
    // offline o.ä. - beim nächsten Start wieder
  }
}

/** Ersteller/Admin: Inhalt aller offenen Termine einer Serie (und künftiger) ändern; Datum bleibt. */
export async function updateTaskSeriesContent(
  seriesId: string,
  updates: {
    title: string;
    description: string | null;
    attachment_path: string | null;
    is_team_task: boolean;
    category: TaskCategory;
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: seriesError } = await (supabase.from as any)('task_series').update(updates).eq('id', seriesId);
  if (seriesError) throw seriesError;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('tasks') as any)
    .update(updates)
    .eq('series_id', seriesId)
    .eq('completed', false);
  if (error) throw error;
}

/** Admin: Serie beenden und alle offenen Termine löschen; erledigte bleiben. */
export async function deleteOpenTasksOfSeries(seriesId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: seriesError } = await (supabase.from as any)('task_series')
    .update({ active: false })
    .eq('id', seriesId);
  if (seriesError) throw seriesError;
  const { error } = await supabase.from('tasks').delete().eq('series_id', seriesId).eq('completed', false);
  if (error) throw error;
}

/** Ersteller/Admin: Titel/Beschrieb/Fälligkeitsdatum/Anhang/Teamaufgabe für die ganze Gruppe ändern. */
export async function updateTaskGroupContent(
  taskGroupId: string,
  updates: {
    title: string;
    description: string | null;
    due_date: string;
    attachment_path: string | null;
    is_team_task: boolean;
    category: TaskCategory;
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('tasks') as any).update(updates).eq('task_group_id', taskGroupId);
  if (error) throw error;
}

/** Empfänger: eigene Zeile - Bemerkung und/oder Erledigt-Status setzen. */
export async function updateTaskCompletion(id: string, completed: boolean, remark: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('tasks') as any)
    .update({ completed, completed_at: completed ? new Date().toISOString() : null, remark })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTaskGroup(taskGroupId: string) {
  const { error } = await supabase.from('tasks').delete().eq('task_group_id', taskGroupId);
  if (error) throw error;
}

/** Empfänger (oder Ersteller/Admin): Aufgabe an eine andere Person weiterleiten. */
export async function forwardTask(taskId: string, toUserId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)('forward_task', { p_task_id: taskId, p_to_user: toUserId });
  if (error) throw error;
}

/** Rollen einer Person für die Zuordnung Sport/Vorstand beim Erstellen. */
export async function fetchTaskPersonRoles(userId: string): Promise<{ isVorstand: boolean; hasSportRole: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('task_person_roles', { p_user_id: userId });
  if (error) throw error;
  const row = ((data ?? []) as { is_vorstand: boolean; has_sport_role: boolean }[])[0];
  return { isVorstand: Boolean(row?.is_vorstand), hasSportRole: Boolean(row?.has_sport_role) };
}
