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

/**
 * Löst Kategorie-/Team-Freitext (z.B. aus einer CSV-Import-Zeile) gegen die
 * bekannten Teams auf. Liefert nur ein Ergebnis, wenn es eindeutig ist -
 * mehrdeutige oder unbekannte Angaben ergeben `undefined`, damit der Aufrufer
 * gezielt auf ein Standard-Team zurückfallen kann.
 */
export function resolveTeamOption(
  teamOptions: TeamOption[],
  category: string,
  team: string,
): TeamOption | undefined {
  const normalizedTeam = team.trim().toLowerCase();
  const normalizedCategory = category.trim().toLowerCase();
  if (!normalizedTeam && !normalizedCategory) return undefined;

  const candidates = teamOptions.filter((t) => {
    const teamMatches = normalizedTeam ? t.teamName.toLowerCase() === normalizedTeam : true;
    const categoryMatches = normalizedCategory ? t.categoryName.toLowerCase() === normalizedCategory : true;
    return teamMatches && categoryMatches;
  });

  return candidates.length === 1 ? candidates[0] : undefined;
}
