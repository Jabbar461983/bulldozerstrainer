import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/database';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import { functionErrorMessage } from '../../lib/functionsError';

export { fetchTeamOptions };
export { fetchRoles, fetchRessorts } from '../roles/api';
export type { TeamOption };

export interface UserTeamRoleView {
  /** null = "Alle Teams". */
  teamId: string | null;
  teamName: string;
  categoryName: string;
  roleId: string;
  roleName: string;
  roleSystemKey: string | null;
  /** Nur bei der Rolle Vorstand. */
  ressortId: string | null;
  ressortName: string | null;
  /** Häkchen Finanzzugriff (Assistenzcoach). */
  financeAccess: boolean;
}

export interface UserRow extends Profile {
  teamRoles: UserTeamRoleView[];
}

export async function fetchUsers(): Promise<UserRow[]> {
  const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }, teamOptions] =
    await Promise.all([
      supabase.from('profiles').select('*').order('last_name', { ascending: true }),
      supabase.from('user_team_roles').select('user_id, team_id, role_id, ressort_id, finance_access, roles(name, system_key), vorstand_ressorts(name)'),
      fetchTeamOptions(),
    ]);
  if (profilesError) throw profilesError;
  if (rolesError) throw rolesError;

  const teamById = new Map(teamOptions.map((t) => [t.teamId, t]));

  return (profiles ?? []).map((profile: Profile) => ({
    ...profile,
    teamRoles: (roles ?? [])
      .filter((r: { user_id: string }) => r.user_id === profile.id)
      .map(
        (r: {
          team_id: string | null;
          role_id: string;
          ressort_id: string | null;
          finance_access: boolean | null;
          roles: { name: string; system_key: string | null } | null;
          vorstand_ressorts: { name: string } | null;
        }) => {
        const team = r.team_id ? teamById.get(r.team_id) : undefined;
        return {
          teamId: r.team_id,
          teamName: r.team_id ? (team?.teamName ?? 'Unbekanntes Team') : 'Alle Teams',
          categoryName: team?.categoryName ?? '',
          roleId: r.role_id,
          roleName: r.roles?.name ?? 'Unbekannte Rolle',
          roleSystemKey: r.roles?.system_key ?? null,
          ressortId: r.ressort_id,
          ressortName: r.vorstand_ressorts?.name ?? null,
          financeAccess: Boolean(r.finance_access),
        };
        },
      ),
  }));
}

export interface TeamRoleInput {
  /** null = "Alle Teams". */
  team_id: string | null;
  role_id: string;
  /** Nur bei der Rolle Vorstand (Pflicht). */
  ressort_id: string | null;
  /** Häkchen Finanzzugriff (nur Assistenzcoach). */
  finance_access: boolean;
}

export async function createUser(payload: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_admin: boolean;
  team_roles: TeamRoleInput[];
}) {
  // Die Edge Function legt nur das Konto an; die Rollen-Zuweisungen setzt der
  // Admin danach direkt (Format mit role_id, siehe Migration 0096).
  const { team_roles, ...body } = payload;
  const { data, error } = await supabase.functions.invoke('admin-create-user', { body });
  if (error) throw new Error(await functionErrorMessage(error, 'Benutzer konnte nicht angelegt werden.'));
  if (data?.error) throw new Error(data.error);
  const userId: string | undefined = data?.user?.id;
  if (userId && team_roles.length > 0) {
    try {
      await replaceTeamRoles(userId, team_roles);
    } catch (err) {
      throw new Error(
        `Benutzer wurde angelegt, die Rollen-Zuweisung ist aber fehlgeschlagen: ${
          err instanceof Error ? err.message : String(err)
        }. Bitte beim Benutzer unter „Bearbeiten“ nachtragen.`,
      );
    }
  }
  return data;
}

export async function setUserPassword(userId: string, password: string) {
  const { data, error } = await supabase.functions.invoke('admin-set-password', {
    body: { user_id: userId, password },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Passwort konnte nicht gesetzt werden.'));
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function deleteUser(userId: string) {
  const { data, error } = await supabase.functions.invoke('admin-delete-user', {
    body: { user_id: userId },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Benutzer konnte nicht gelöscht werden.'));
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function updateProfile(
  id: string,
  updates: Partial<Pick<Profile, 'first_name' | 'last_name' | 'phone' | 'is_admin'>>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('profiles') as any).update(updates).eq('id', id);
  if (error) throw error;
}

export async function replaceTeamRoles(userId: string, teamRoles: TeamRoleInput[]) {
  const { error: deleteError } = await supabase.from('user_team_roles').delete().eq('user_id', userId);
  if (deleteError) throw deleteError;
  if (teamRoles.length === 0) return;
  // Doppelte Zeilen (gleicher Bereich + gleiche Rolle) nur einmal speichern.
  const unique = new Map(teamRoles.map((tr) => [`${tr.team_id ?? 'alle'}|${tr.role_id}|${tr.ressort_id ?? ''}`, tr]));
  const rows = Array.from(unique.values()).map((tr) => ({
    user_id: userId,
    team_id: tr.team_id,
    role_id: tr.role_id,
    ressort_id: tr.ressort_id,
    finance_access: tr.finance_access,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase.from('user_team_roles') as any).insert(rows);
  if (insertError) throw insertError;
}
