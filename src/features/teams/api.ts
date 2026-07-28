import { supabase } from '../../lib/supabase';
import type { Category, CoachRole, Profile, Team } from '../../types/database';

export interface CoachAssignmentView {
  userId: string;
  firstName: string;
  lastName: string;
  role: CoachRole;
}

export interface TeamRow extends Team {
  categoryName: string;
  coachAssignments: CoachAssignmentView[];
}

export interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CoachAssignmentInput {
  user_id: string;
  role: CoachRole;
}

const FOREIGN_KEY_VIOLATION = '23503';

function friendlyError(err: unknown, fallback: string): Error {
  if (err && typeof err === 'object' && 'code' in err && err.code === FOREIGN_KEY_VIOLATION) {
    return new Error(fallback);
  }
  return err instanceof Error ? err : new Error(fallback);
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAssignableUsers(): Promise<AssignableUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, is_admin')
    .order('last_name', { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((p: Pick<Profile, 'is_admin'>) => !p.is_admin)
    .map((p: Pick<Profile, 'id' | 'first_name' | 'last_name'>) => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
    }));
}

export async function fetchTeams(): Promise<TeamRow[]> {
  const [{ data: teams, error: teamsError }, { data: categories, error: categoriesError }, { data: profiles, error: profilesError }, { data: roles, error: rolesError }] =
    await Promise.all([
      supabase.from('teams').select('*').order('season', { ascending: false }),
      supabase.from('categories').select('*'),
      supabase.from('profiles').select('id, first_name, last_name'),
      supabase.from('user_team_roles').select('user_id, team_id, role'),
    ]);
  if (teamsError) throw teamsError;
  if (categoriesError) throw categoriesError;
  if (profilesError) throw profilesError;
  if (rolesError) throw rolesError;

  const categoryById = new Map((categories ?? []).map((c: Category) => [c.id, c]));
  const profileById = new Map(
    (profiles ?? []).map((p: Pick<Profile, 'id' | 'first_name' | 'last_name'>) => [p.id, p]),
  );

  return (teams ?? []).map((team: Team) => ({
    ...team,
    categoryName: categoryById.get(team.category_id)?.name ?? '?',
    coachAssignments: (roles ?? [])
      .filter((r: { team_id: string }) => r.team_id === team.id)
      .map((r: { user_id: string; role: CoachRole }) => {
        const profile = profileById.get(r.user_id);
        return {
          userId: r.user_id,
          firstName: profile?.first_name ?? 'Unbekannt',
          lastName: profile?.last_name ?? '',
          role: r.role,
        };
      }),
  }));
}

export async function createCategory(payload: {
  name: string;
  sort_order: number;
  is_default: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('categories') as any).insert(payload);
  if (error) throw error;
}

export async function updateCategory(
  id: string,
  updates: Partial<Pick<Category, 'name' | 'sort_order' | 'is_default'>>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('categories') as any).update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw friendlyError(error, 'Kategorie kann nicht gelöscht werden, solange ihr Teams zugeordnet sind.');
}

export async function createTeam(payload: {
  category_id: string;
  name: string;
  season: string;
  default_training_duration_minutes: number;
  coachAssignments: CoachAssignmentInput[];
}) {
  const { coachAssignments, ...teamPayload } = payload;
  const { data, error } = await (supabase.from('teams') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert(teamPayload)
    .select('id')
    .single();
  if (error) throw error;
  await replaceCoachAssignments(data.id, coachAssignments);
}

export async function updateTeam(
  id: string,
  updates: Partial<Pick<Team, 'category_id' | 'name' | 'season' | 'default_training_duration_minutes'>>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('teams') as any).update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteTeam(id: string) {
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw friendlyError(error, 'Team kann nicht gelöscht werden, solange es z.B. bei Spielen referenziert wird.');
}

export async function replaceCoachAssignments(teamId: string, assignments: CoachAssignmentInput[]) {
  const { error: deleteError } = await supabase.from('user_team_roles').delete().eq('team_id', teamId);
  if (deleteError) throw deleteError;
  if (assignments.length === 0) return;
  const rows = assignments.map((a) => ({ user_id: a.user_id, team_id: teamId, role: a.role }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase.from('user_team_roles') as any).insert(rows);
  if (insertError) throw insertError;
}
