import { supabase } from './supabase';
import type { Category, Team } from '../types/database';

export interface TeamOption {
  teamId: string;
  teamName: string;
  categoryId: string;
  categoryName: string;
  season: string;
}

export async function fetchTeamOptions(): Promise<TeamOption[]> {
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .order('season', { ascending: false });
  if (teamsError) throw teamsError;
  const { data: categories, error: categoriesError } = await supabase.from('categories').select('*');
  if (categoriesError) throw categoriesError;

  const categoryById = new Map((categories ?? []).map((c: Category) => [c.id, c]));
  return (teams ?? []).map((t: Team) => ({
    teamId: t.id,
    teamName: t.name,
    categoryId: t.category_id,
    categoryName: categoryById.get(t.category_id)?.name ?? '?',
    season: t.season,
  }));
}
