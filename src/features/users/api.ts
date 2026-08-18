import { supabase } from '../../lib/supabase';
import type { CoachRole, Profile } from '../../types/database';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import { functionErrorMessage } from '../../lib/functionsError';

export { fetchTeamOptions };
export type { TeamOption };

export interface UserTeamRoleView {
  teamId: string;
  teamName: string;
  categoryName: string;
  role: CoachRole;
  financeAccess: boolean;
}

export interface UserRow extends Profile {
  teamRoles: UserTeamRoleView[];
}

export async function fetchUsers(): Promise<UserRow[]> {
  const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }, teamOptions] =
    await Promise.all([
      supabase.from('profiles').select('*').order('last_name', { ascending: true }),
      supabase.from('user_team_roles').select('user_id, team_id, role, finance_access'),
      fetchTeamOptions(),
    ]);
  if (profilesError) throw profilesError;
  if (rolesError) throw rolesError;

  const teamById = new Map(teamOptions.map((t) => [t.teamId, t]));

  return (profiles ?? []).map((profile: Profile) => ({
    ...profile,
    teamRoles: (roles ?? [])
      .filter((r: { user_id: string }) => r.user_id === profile.id)
      .map((r: { team_id: string; role: CoachRole; finance_access: boolean }) => {
        const team = teamById.get(r.team_id);
        return {
          teamId: r.team_id,
          teamName: team?.teamName ?? 'Unbekanntes Team',
          categoryName: team?.categoryName ?? '',
          role: r.role,
          financeAccess: r.finance_access,
        };
      }),
  }));
}

export interface TeamRoleInput {
  team_id: string;
  role: CoachRole;
  finance_access: boolean;
}

export async function createUser(payload: {
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_admin: boolean;
  team_roles: TeamRoleInput[];
}) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', { body: payload });
  if (error) throw new Error(await functionErrorMessage(error, 'Benutzer konnte nicht angelegt werden.'));
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
  const rows = teamRoles.map((tr) => ({
    user_id: userId,
    team_id: tr.team_id,
    role: tr.role,
    finance_access: tr.finance_access,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase.from('user_team_roles') as any).insert(rows);
  if (insertError) throw insertError;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/passwort-zuruecksetzen`,
  });
  if (error) throw error;
}
