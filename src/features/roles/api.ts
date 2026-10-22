import { supabase } from '../../lib/supabase';
import type { Role, VorstandRessort } from '../../types/database';

export interface RoleRow extends Role {
  assignmentCount: number;
}

const FOREIGN_KEY_VIOLATION = '23503';

export async function fetchRoles(): Promise<Role[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Role[];
}

export async function fetchRolesWithCounts(): Promise<RoleRow[]> {
  const [roles, { data: assignments, error }] = await Promise.all([
    fetchRoles(),
    supabase.from('user_team_roles').select('role_id'),
  ]);
  if (error) throw error;
  const countByRole = new Map<string, number>();
  for (const a of (assignments ?? []) as { role_id: string }[]) {
    countByRole.set(a.role_id, (countByRole.get(a.role_id) ?? 0) + 1);
  }
  return roles.map((r) => ({ ...r, assignmentCount: countByRole.get(r.id) ?? 0 }));
}

export async function createRole(payload: { name: string; modules: string[] }) {
  const roles = await fetchRoles();
  const sort_order = Math.max(0, ...roles.map((r) => r.sort_order)) + 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('roles') as any).insert({ ...payload, sort_order });
  if (error) throw friendlyRoleError(error);
}

export async function updateRole(id: string, payload: { name: string; modules: string[] }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('roles') as any).update(payload).eq('id', id);
  if (error) throw friendlyRoleError(error);
}

export async function deleteRole(id: string) {
  const { error } = await supabase.from('roles').delete().eq('id', id);
  if (error) throw friendlyRoleError(error);
}

function friendlyRoleError(err: { code?: string; message?: string }): Error {
  if (err.code === FOREIGN_KEY_VIOLATION) {
    return new Error('Die Rolle ist noch Personen zugewiesen. Entferne zuerst diese Zuweisungen.');
  }
  if (err.code === '23505') return new Error('Es gibt bereits eine Rolle mit diesem Namen.');
  return new Error(err.message ?? 'Rolle konnte nicht gespeichert werden.');
}

// ---------------- Vorstand-Ressorts ----------------

export async function fetchRessorts(): Promise<VorstandRessort[]> {
  const { data, error } = await supabase
    .from('vorstand_ressorts')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as VorstandRessort[];
}

export async function createRessort(name: string, sortOrder: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('vorstand_ressorts') as any).insert({ name, sort_order: sortOrder });
  if (error) throw friendlyRessortError(error);
}

export async function renameRessort(id: string, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('vorstand_ressorts') as any).update({ name }).eq('id', id);
  if (error) throw friendlyRessortError(error);
}

export async function deleteRessort(id: string) {
  const { error } = await supabase.from('vorstand_ressorts').delete().eq('id', id);
  if (error) throw friendlyRessortError(error);
}

/** Speichert die Reihenfolge (sort_order = Position + 1). */
export async function saveRessortOrder(ids: string[]) {
  for (const [index, id] of ids.entries()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('vorstand_ressorts') as any).update({ sort_order: index + 1 }).eq('id', id);
    if (error) throw friendlyRessortError(error);
  }
}

function friendlyRessortError(err: { code?: string; message?: string }): Error {
  if (err.code === FOREIGN_KEY_VIOLATION) {
    return new Error('Dem Ressort sind noch Personen zugewiesen. Entferne zuerst diese Zuweisungen unter „Benutzer“.');
  }
  if (err.code === '23505') return new Error('Es gibt bereits ein Ressort mit diesem Namen.');
  return new Error(err.message ?? 'Ressort konnte nicht gespeichert werden.');
}
