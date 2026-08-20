import { supabase } from '../../lib/supabase';
import type { Game, GameAbsence, GameLineup, GameLineupPosition, GameRating, GameRatingCategory, PlayerNote } from '../../types/database';
import type { FixtureImportRow } from '../../lib/csv';
import { fetchTeamPlayerRoster, fetchTeamTrainerRoster } from '../../lib/roster';
import type { RosterPlayer, RosterTrainer } from '../../lib/roster';

export { fetchTeamPlayerRoster, fetchTeamTrainerRoster };
export type { RosterPlayer, RosterTrainer };

export const GAME_RATING_CATEGORIES: { value: GameRatingCategory; label: string }[] = [
  { value: 'goalie', label: 'Torhüter' },
  { value: 'defense', label: 'Verteidigung' },
  { value: 'offense', label: 'Angriff' },
  { value: 'powerplay', label: 'Powerplay' },
  { value: 'boxplay', label: 'Boxplay' },
  { value: 'overall', label: 'Gesamt' },
];

export const LINEUP_POSITIONS: { value: GameLineupPosition; label: string }[] = [
  { value: 'goalie', label: 'Torhüter' },
  { value: 'defense', label: 'Verteidigung' },
  { value: 'wing', label: 'Flügel' },
  { value: 'center', label: 'Center' },
  { value: 'field', label: 'Feld' },
];

export async function fetchGames(teamId: string): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('our_team_id', teamId)
    .order('date', { ascending: false })
    .order('time', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Game[];
}

export async function createGame(payload: {
  our_team_id: string;
  category_id: string | null;
  date: string;
  time: string | null;
  location: string | null;
  home_team: string;
  away_team: string;
  season: string | null;
  is_home?: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('games') as any).insert({
    ...payload,
    is_home: payload.is_home ?? true,
  });
  if (error) throw error;
}

export async function updateGame(
  id: string,
  updates: Partial<
    Pick<
      Game,
      'date' | 'time' | 'location' | 'home_team' | 'away_team' | 'season' | 'result_us' | 'result_them' | 'pre_game_notes'
    >
  >,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('games') as any).update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteGame(id: string) {
  const { error } = await supabase.from('games').delete().eq('id', id);
  if (error) throw error;
}

export async function importGames(rows: FixtureImportRow[], teamId: string, categoryId: string | null) {
  const validRows = rows.filter((r) => r.valid);
  for (const row of validRows) {
    await createGame({
      our_team_id: teamId,
      category_id: categoryId,
      date: row.date as string,
      time: row.time,
      location: row.location || null,
      home_team: row.homeTeam,
      away_team: row.awayTeam,
      season: row.season || null,
    });
  }
}

export async function fetchGameLineup(gameId: string): Promise<GameLineup[]> {
  const { data, error } = await supabase.from('game_lineups').select('*').eq('game_id', gameId);
  if (error) throw error;
  return (data ?? []) as GameLineup[];
}

export async function replaceGameLineup(
  gameId: string,
  entries: { player_id: string; block_number: number | null; position: GameLineupPosition | null }[],
) {
  const { error: deleteError } = await supabase.from('game_lineups').delete().eq('game_id', gameId);
  if (deleteError) throw deleteError;
  if (entries.length === 0) return;
  const rows = entries.map((e) => ({ game_id: gameId, ...e }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase.from('game_lineups') as any).insert(rows);
  if (insertError) throw insertError;
}

export async function fetchGameAbsences(gameId: string): Promise<GameAbsence[]> {
  const { data, error } = await supabase.from('game_absences').select('*').eq('game_id', gameId);
  if (error) throw error;
  return (data ?? []) as GameAbsence[];
}

export async function replaceGameAbsences(gameId: string, playerIds: string[], trainerIds: string[]) {
  const { error: deleteError } = await supabase.from('game_absences').delete().eq('game_id', gameId);
  if (deleteError) throw deleteError;
  const rows = [
    ...playerIds.map((playerId) => ({ game_id: gameId, person_type: 'player' as const, player_id: playerId, trainer_id: null })),
    ...trainerIds.map((trainerId) => ({ game_id: gameId, person_type: 'trainer' as const, player_id: null, trainer_id: trainerId })),
  ];
  if (rows.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase.from('game_absences') as any).insert(rows);
  if (insertError) throw insertError;
}

export async function fetchGameRatings(gameId: string): Promise<GameRating[]> {
  const { data, error } = await supabase.from('game_ratings').select('*').eq('game_id', gameId);
  if (error) throw error;
  return (data ?? []) as GameRating[];
}

export async function saveGameRating(
  gameId: string,
  existingId: string | null,
  category: GameRatingCategory,
  stars: number,
  notes: string | null,
  createdBy: string | null,
) {
  if (existingId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('game_ratings') as any).update({ stars, notes }).eq('id', existingId);
    if (error) throw error;
  } else {
    const { error } = await (supabase.from('game_ratings') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert({ game_id: gameId, category, stars, notes, created_by: createdBy });
    if (error) throw error;
  }
}

export interface GameCommentRow extends PlayerNote {
  playerName: string;
}

// Spielerkommentare landen in player_notes (source='game'), damit sie auch
// in den Notizen des Spielers (PlayerNotes.tsx) erscheinen.
export async function fetchGameComments(gameId: string): Promise<GameCommentRow[]> {
  const { data: comments, error: commentsError } = await supabase
    .from('player_notes')
    .select('*')
    .eq('source', 'game')
    .eq('source_id', gameId)
    .order('created_at', { ascending: false });
  if (commentsError) throw commentsError;

  const playerIds = Array.from(new Set((comments ?? []).map((c: PlayerNote) => c.player_id)));
  let nameById = new Map<string, string>();
  if (playerIds.length > 0) {
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .in('id', playerIds);
    if (playersError) throw playersError;
    nameById = new Map(
      (players ?? []).map((p: { id: string; first_name: string; last_name: string }) => [
        p.id,
        `${p.first_name} ${p.last_name}`,
      ]),
    );
  }

  return (comments ?? []).map((c: PlayerNote) => ({
    ...c,
    playerName: nameById.get(c.player_id) ?? 'Unbekannt',
  }));
}

export async function addGameComment(gameId: string, playerId: string, note: string, createdBy: string | null) {
  const { error } = await (supabase.from('player_notes') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({ player_id: playerId, source: 'game', source_id: gameId, note, created_by: createdBy });
  if (error) throw error;
}

// Nur Admins dürfen Spielerkommentare löschen (RLS: player_notes_delete).
export async function deleteGameComment(id: string) {
  const { error } = await supabase.from('player_notes').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchPastGamesForSeason(teamId: string, season: string): Promise<Game[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('our_team_id', teamId)
    .eq('season', season)
    .lte('date', today)
    .order('date', { ascending: false })
    .order('time', { ascending: false });
  if (error) throw error;

  const games = (data ?? []) as Game[];
  const now = new Date();
  return games.filter((game) => {
    if (game.date < today) return true;
    if (game.date === today && game.time) {
      const gameTime = new Date(`${game.date}T${game.time}`);
      return gameTime < now;
    }
    return false;
  });
}

export async function fetchGameLineups(gameId: string): Promise<GameLineup[]> {
  const { data, error } = await supabase
    .from('game_lineups')
    .select('*')
    .eq('game_id', gameId);
  if (error) throw error;
  return (data ?? []) as GameLineup[];
}

export async function copyGameLineups(sourceGameId: string, targetGameId: string): Promise<void> {
  const sourceLineups = await fetchGameLineups(sourceGameId);
  const sourceAbsences = await fetchGameAbsences(sourceGameId);

  const absentPlayerIds = new Set(
    sourceAbsences
      .filter((a) => a.person_type === 'player')
      .map((a) => a.player_id)
      .filter((id) => id !== null),
  );

  if (sourceLineups.length === 0) return;

  const newLineups = sourceLineups
    .filter((lineup) => !absentPlayerIds.has(lineup.player_id))
    .map((lineup: GameLineup) => {
      const { id, ...rest } = lineup;
      return {
        ...rest,
        game_id: targetGameId,
      };
    });

  const { error: deleteError } = await supabase.from('game_lineups').delete().eq('game_id', targetGameId);
  if (deleteError) throw deleteError;

  if (newLineups.length > 0) {
    const { error: insertError } = await (supabase.from('game_lineups') as any).insert(newLineups);
    if (insertError) throw insertError;
  }
}
