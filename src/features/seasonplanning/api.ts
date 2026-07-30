import { supabase } from '../../lib/supabase';
import type {
  SeasonPlanningEvent,
  TrainingSeasonFocus,
  TrainingFocusPercentage,
  SeasonPlanningCategory,
  ExerciseFocus,
} from '../../types/database';

// Ordnet die Übungs-Inhalte den 4 Saisonplanungs-Kategorien zu, damit der Zeitanteil
// pro Kategorie automatisch aus den geplanten Übungen berechnet werden kann.
// "activities" (Vereinsanlässe wie Testspiele/Teamweihnachten) hat bewusst keine
// zugeordneten Inhalte - das ergibt sich nicht aus Trainingsübungen.
const FOCUS_CATEGORY_MAP: Partial<Record<ExerciseFocus, SeasonPlanningCategory>> = {
  Angriff: 'tactics',
  Verteidigung: 'tactics',
  Schuss: 'technique',
  Passspiel: 'technique',
  Ballabdecken: 'technique',
  'Lösen vom Gegner': 'technique',
  Bullys: 'technique',
  Zweikampfverhalten: 'technique',
  Specialteams: 'tactics',
  Torhüter: 'technique',
  Spiel: 'tactics',
  Kraft: 'physical',
  Ausdauer: 'physical',
  Koordination: 'physical',
  Schnelligkeit: 'physical',
  'Off Field Spiel': 'physical',
};

export async function fetchSeasonPlanningEvents(teamId: string): Promise<SeasonPlanningEvent[]> {
  const { data, error } = await (supabase as any)
    .from('season_planning_events')
    .select('*')
    .eq('team_id', teamId)
    .order('start_date', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createSeasonPlanningEvent(event: Omit<SeasonPlanningEvent, 'id' | 'created_at' | 'updated_at'>): Promise<SeasonPlanningEvent> {
  const { data, error } = await (supabase as any)
    .from('season_planning_events')
    .insert([event])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSeasonPlanningEvent(id: string, updates: Partial<SeasonPlanningEvent>): Promise<SeasonPlanningEvent> {
  const { data, error } = await (supabase as any)
    .from('season_planning_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSeasonPlanningEvent(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('season_planning_events')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function fetchTrainingSeasonFocuses(trainingId: string): Promise<TrainingSeasonFocus[]> {
  const { data, error } = await (supabase as any)
    .from('training_season_focuses')
    .select('*')
    .eq('training_id', trainingId);
  if (error) throw error;
  return data ?? [];
}

export async function addTrainingSeasonFocus(trainingId: string, eventId: string): Promise<TrainingSeasonFocus> {
  const { data, error } = await (supabase as any)
    .from('training_season_focuses')
    .insert([{ training_id: trainingId, season_planning_event_id: eventId }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeTrainingSeasonFocus(trainingId: string, eventId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('training_season_focuses')
    .delete()
    .eq('training_id', trainingId)
    .eq('season_planning_event_id', eventId);
  if (error) throw error;
}

export async function fetchTrainingFocusPercentages(trainingId: string): Promise<Record<SeasonPlanningCategory, number>> {
  const { data, error } = await (supabase as any)
    .from('training_focus_percentages')
    .select('*')
    .eq('training_id', trainingId);
  if (error) throw error;

  const result: Record<SeasonPlanningCategory, number> = {
    activities: 0,
    technique: 0,
    tactics: 0,
    physical: 0,
  };

  for (const row of data ?? []) {
    result[row.category as SeasonPlanningCategory] = row.percentage;
  }

  return result;
}

export async function setTrainingFocusPercentage(trainingId: string, category: SeasonPlanningCategory, percentage: number): Promise<TrainingFocusPercentage> {
  const { data, error } = await (supabase as any)
    .from('training_focus_percentages')
    .upsert(
      [{ training_id: trainingId, category, percentage, updated_at: new Date().toISOString() }],
      { onConflict: 'training_id,category' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Berechnet den Zeitanteil pro Saisonplanungs-Kategorie automatisch aus den
// tatsächlich geplanten Übungen (Dauer je Übung, gleichmässig aufgeteilt, falls eine
// Übung mehrere Inhalte aus verschiedenen Kategorien hat).
export async function computeTrainingFocusPercentages(trainingId: string): Promise<Record<SeasonPlanningCategory, number>> {
  const result: Record<SeasonPlanningCategory, number> = {
    activities: 0,
    technique: 0,
    tactics: 0,
    physical: 0,
  };

  const { data: exerciseRows, error: exerciseRowsError } = await supabase
    .from('training_exercises')
    .select('exercise_id, duration_minutes')
    .eq('training_id', trainingId);
  if (exerciseRowsError) throw exerciseRowsError;
  const rows = (exerciseRows ?? []) as { exercise_id: string; duration_minutes: number }[];
  if (rows.length === 0) return result;

  const exerciseIds = Array.from(new Set(rows.map((r) => r.exercise_id)));
  const { data: exercises, error: exercisesError } = await supabase
    .from('exercises')
    .select('id, focus_areas')
    .in('id', exerciseIds);
  if (exercisesError) throw exercisesError;
  const focusById = new Map(
    (exercises ?? []).map((e: { id: string; focus_areas: ExerciseFocus[] }) => [e.id, e.focus_areas]),
  );

  const categoryMinutes: Record<SeasonPlanningCategory, number> = {
    activities: 0,
    technique: 0,
    tactics: 0,
    physical: 0,
  };
  let totalMinutes = 0;
  for (const row of rows) {
    totalMinutes += row.duration_minutes;
    const focusAreas = focusById.get(row.exercise_id) ?? [];
    const categories = Array.from(
      new Set(focusAreas.map((f) => FOCUS_CATEGORY_MAP[f]).filter((c): c is SeasonPlanningCategory => !!c)),
    );
    if (categories.length === 0) continue;
    const share = row.duration_minutes / categories.length;
    for (const cat of categories) categoryMinutes[cat] += share;
  }

  if (totalMinutes === 0) return result;
  for (const cat of Object.keys(categoryMinutes) as SeasonPlanningCategory[]) {
    result[cat] = Math.round((categoryMinutes[cat] / totalMinutes) * 100);
  }
  return result;
}

export async function getSeasonDateRange(season: string): Promise<{ startDate: string; endDate: string }> {
  // Season is like "2024/25", returns July 1, 2024 to May 31, 2025
  const [startYear] = season.split('/').map(Number);
  const startDate = `${startYear}-07-01`;
  const endDate = `${startYear + 1}-05-31`;
  return { startDate, endDate };
}

// Helper: Get all events for a given date range (for calendar view)
export async function fetchSeasonPlanningEventsByDateRange(
  teamId: string,
  startDate: string,
  endDate: string
): Promise<SeasonPlanningEvent[]> {
  const { data, error } = await (supabase as any)
    .from('season_planning_events')
    .select('*')
    .eq('team_id', teamId)
    .gte('end_date', startDate)
    .lte('start_date', endDate)
    .order('start_date', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Helper: Get events applicable to a specific training date
export async function fetchApplicableSeasonPlanningEvents(teamId: string, trainingDate: string): Promise<SeasonPlanningEvent[]> {
  const { data, error } = await (supabase as any)
    .from('season_planning_events')
    .select('*')
    .eq('team_id', teamId)
    .lte('start_date', trainingDate)
    .gte('end_date', trainingDate)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
