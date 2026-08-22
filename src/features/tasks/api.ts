import { supabase } from '../../lib/supabase';
import type { Task } from '../../types/database';

const ATTACHMENTS_BUCKET = 'task-attachments';
const SIGNED_URL_TTL_SECONDS = 3600;
export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;

export interface TaskRow extends Task {
  creatorName: string;
  assigneeName: string;
  attachmentUrl: string | null;
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

async function attachRowMeta(rows: Task[]): Promise<TaskRow[]> {
  const ids = Array.from(new Set(rows.flatMap((r) => [r.created_by, r.assigned_to])));
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

  return rows.map((r) => ({
    ...r,
    creatorName: nameById.get(r.created_by) ?? 'Unbekannt',
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
    .order('due_date', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return attachRowMeta((data ?? []) as Task[]);
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
  return attachRowMeta((data ?? []) as Task[]);
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
  return attachRowMeta((data ?? []) as Task[]);
}

/** Admin-Gesamtübersicht über alle Aufgaben im System. */
export async function fetchAllTasks(): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('due_date', { ascending: true });
  if (error) throw error;
  return attachRowMeta((data ?? []) as Task[]);
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

export type TaskRecipientScope = 'team_coaches' | 'all_headcoaches' | 'all_coaches' | 'all_users';

export async function fetchTaskRecipientOptions(
  scope: TaskRecipientScope,
  teamId?: string,
): Promise<UserOptionForTask[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('task_recipients', { p_scope: scope, p_team_id: teamId ?? null });
  if (error) throw error;
  return (data ?? []).map((u: { user_id: string; first_name: string; last_name: string }) => ({
    userId: u.user_id,
    firstName: u.first_name,
    lastName: u.last_name,
  }));
}

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
    created_by: payload.created_by,
    assigned_to: assignedTo,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('tasks') as any).insert(rows);
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
