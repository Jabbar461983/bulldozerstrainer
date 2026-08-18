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
  Offensivverhalten: 'tactics',
  Schuss: 'technique',
  Passen: 'technique',
  Aufbau: 'technique',
  Ballabdecken: 'technique',
  'Lösen vom Gegner': 'technique',
  Bullys: 'technique',
  Zweikampf: 'technique',
  Überzahlsituation: 'tactics',
  Specialteams: 'tactics',
  Torhüter: 'technique',
  Minigames: 'tactics',
  Spiel: 'tactics',
  Kraft: 'physical',
  Ausdauer: 'physical',
  Koordination: 'physical',
  Schnelligkeit: 'physical',
  'Off Field Spiel': 'physical',
};

// Ordnet die konkreten Saisonplanungs-Unterkategorien (aus SeasonPlanningDialog) den
// passenden Übungs-Inhalten zu. Nur Übungen mit einem dieser Inhalte zählen als
// Abdeckung des jeweiligen Schwerpunkts - eine Passen-Übung deckt z.B. den
// Schwerpunkt "Schiessen" nicht ab, auch wenn beides "Technik" ist.
// Unterkategorien ohne Eintrag (z.B. "Wechsel", "Sommer-Training") haben keine
// Entsprechung bei den Übungs-Inhalten und ergeben daher bewusst immer 0%.
const SUBCATEGORY_FOCUS_MAP: Partial<Record<string, ExerciseFocus[]>> = {
  Passen: ['Passen'],
  Schiessen: ['Schuss'],
  Ballabdecken: ['Ballabdecken'],
  'Lösen vom Gegner': ['Lösen vom Gegner'],
  Bullys: ['Bullys'],
  Zweikampf: ['Zweikampf'],
  Aufbau: ['Aufbau'],
  Offensivtaktiken: ['Offensivverhalten'],
  Überzahlsituation: ['Überzahlsituation'],
  Specialteams: ['Specialteams'],
  'Body-pump': ['Kraft'],
};

type CategoryFocusTarget = 'any' | Set<ExerciseFocus>;

// Bestimmt pro Kategorie, welche Übungs-Inhalte als "passend" zum aktuell für dieses
// Trainingsdatum geltenden Saisonplan gelten:
// - keine zutreffenden Events in der Kategorie -> leeres Set (nie 0% übersteigend)
// - mind. ein Event ohne konkrete Unterkategorie -> 'any' (ganze Kategorie zählt, wie
//   bisher), da der Coach keinen spezifischen Schwerpunkt vorgegeben hat
// - sonst -> Set der Inhalte aller angegebenen Unterkategorien dieser Kategorie
function getCategoryFocusTarget(
  applicableEvents: SeasonPlanningEvent[],
  category: SeasonPlanningCategory,
): CategoryFocusTarget {
  const categoryEvents = applicableEvents.filter((e) => e.category === category);
  if (categoryEvents.length === 0) return new Set();
  if (categoryEvents.some((e) => !e.subcategory)) return 'any';
  const targets = new Set<ExerciseFocus>();
  for (const event of categoryEvents) {
    const mapped = SUBCATEGORY_FOCUS_MAP[event.subcategory as string];
    mapped?.forEach((f) => targets.add(f));
  }
  return targets;
}

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

function buildCategoryTargets(applicableEvents: SeasonPlanningEvent[]): Record<SeasonPlanningCategory, CategoryFocusTarget> {
  return {
    activities: getCategoryFocusTarget(applicableEvents, 'activities'),
    technique: getCategoryFocusTarget(applicableEvents, 'technique'),
    tactics: getCategoryFocusTarget(applicableEvents, 'tactics'),
    physical: getCategoryFocusTarget(applicableEvents, 'physical'),
  };
}

function exerciseMatchesAnyTarget(
  focusAreas: ExerciseFocus[],
  categoryTargets: Record<SeasonPlanningCategory, CategoryFocusTarget>,
): boolean {
  for (const focus of focusAreas) {
    const category = FOCUS_CATEGORY_MAP[focus];
    if (!category) continue;
    const target = categoryTargets[category];
    if (target === 'any' || target.has(focus)) return true;
  }
  return false;
}

// Berechnet, wie viel Prozent der geplanten Übungsdauer eines Trainings zu den für
// dieses Datum geltenden Saisonplan-Schwerpunkten passt (ein einzelner Gesamtwert,
// nicht mehr pro Kategorie). Eine Übung zählt nur, wenn ihr Inhalt zur konkreten
// Unterkategorie des jeweiligen Saisonplan-Eintrags passt (z.B. deckt eine
// Passen-Übung den Schwerpunkt "Schiessen" nicht ab, auch wenn beides unter
// "Technik" fällt).
export async function computeTrainingSeasonCoverage(
  trainingId: string,
  applicableEvents: SeasonPlanningEvent[],
): Promise<number> {
  const { data: exerciseRows, error: exerciseRowsError } = await supabase
    .from('training_exercises')
    .select('exercise_id, duration_minutes')
    .eq('training_id', trainingId);
  if (exerciseRowsError) throw exerciseRowsError;
  const rows = (exerciseRows ?? []) as { exercise_id: string; duration_minutes: number }[];
  if (rows.length === 0) return 0;

  const exerciseIds = Array.from(new Set(rows.map((r) => r.exercise_id)));
  const { data: exercises, error: exercisesError } = await supabase
    .from('exercises')
    .select('id, focus_areas')
    .in('id', exerciseIds);
  if (exercisesError) throw exercisesError;
  const focusById = new Map(
    (exercises ?? []).map((e: { id: string; focus_areas: ExerciseFocus[] }) => [e.id, e.focus_areas]),
  );

  const categoryTargets = buildCategoryTargets(applicableEvents);
  let totalMinutes = 0;
  let matchedMinutes = 0;
  for (const row of rows) {
    totalMinutes += row.duration_minutes;
    const focusAreas = focusById.get(row.exercise_id) ?? [];
    if (exerciseMatchesAnyTarget(focusAreas, categoryTargets)) matchedMinutes += row.duration_minutes;
  }

  return totalMinutes > 0 ? Math.round((matchedMinutes / totalMinutes) * 100) : 0;
}

// Batch-Variante für die Trainings-Übersicht: berechnet die Saisonplanungs-Abdeckung
// für mehrere Trainings eines Teams in nur 3 Abfragen (statt einer Abfrage je
// Training).
export async function computeSeasonCoverageForTrainings(
  teamId: string,
  trainings: { id: string; date: string }[],
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const t of trainings) result[t.id] = 0;
  if (trainings.length === 0) return result;

  const trainingIds = trainings.map((t) => t.id);
  const { data: exerciseRows, error: exerciseRowsError } = await supabase
    .from('training_exercises')
    .select('training_id, exercise_id, duration_minutes')
    .in('training_id', trainingIds);
  if (exerciseRowsError) throw exerciseRowsError;
  const rows = (exerciseRows ?? []) as { training_id: string; exercise_id: string; duration_minutes: number }[];
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

  const { data: events, error: eventsError } = await (supabase as any)
    .from('season_planning_events')
    .select('*')
    .eq('team_id', teamId);
  if (eventsError) throw eventsError;
  const allEvents = (events ?? []) as SeasonPlanningEvent[];

  const rowsByTraining = new Map<string, { exercise_id: string; duration_minutes: number }[]>();
  for (const row of rows) {
    const list = rowsByTraining.get(row.training_id) ?? [];
    list.push(row);
    rowsByTraining.set(row.training_id, list);
  }

  for (const t of trainings) {
    const trainingRows = rowsByTraining.get(t.id) ?? [];
    if (trainingRows.length === 0) continue;
    const applicableEvents = allEvents.filter((e) => e.start_date <= t.date && e.end_date >= t.date);
    const categoryTargets = buildCategoryTargets(applicableEvents);
    let totalMinutes = 0;
    let matchedMinutes = 0;
    for (const row of trainingRows) {
      totalMinutes += row.duration_minutes;
      const focusAreas = focusById.get(row.exercise_id) ?? [];
      if (exerciseMatchesAnyTarget(focusAreas, categoryTargets)) matchedMinutes += row.duration_minutes;
    }
    result[t.id] = totalMinutes > 0 ? Math.round((matchedMinutes / totalMinutes) * 100) : 0;
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
