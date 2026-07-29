// Handgeschriebene Typen passend zu supabase/migrations/*.sql.
// Bei Bedarf später ersetzbar durch `supabase gen types typescript`.

export type CoachRole = 'headcoach' | 'assistant_coach' | 'finance';
export type AppRole = 'admin' | CoachRole;

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
}

export interface Team {
  id: string;
  category_id: string;
  name: string;
  season: string;
  default_training_duration_minutes: number;
  created_at: string;
}

export interface UserTeamRole {
  id: string;
  user_id: string;
  team_id: string;
  role: CoachRole;
}

export interface Player {
  id: string;
  first_name: string;
  last_name: string;
  birthdate: string | null;
  created_at: string;
}

export interface PlayerTeam {
  player_id: string;
  team_id: string;
}

export interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
  birthdate: string | null;
  created_at: string;
}

export interface TrainerTeam {
  trainer_id: string;
  team_id: string;
}

export interface PlayerNote {
  id: string;
  player_id: string;
  source: 'training' | 'game' | 'misc';
  source_id: string | null;
  note: string;
  created_by: string | null;
  created_at: string;
}

export type ExerciseFocus =
  // On Field
  | 'Angriff'
  | 'Verteidigung'
  | 'Schuss'
  | 'Passspiel'
  | 'Powerplay'
  | 'Boxplay'
  | 'Torhüter'
  | 'Spiel'
  // Off Field
  | 'Kraft'
  | 'Ausdauer'
  | 'Koordination'
  | 'Schnelligkeit'
  | 'Off Field Spiel';

export type TrainingFieldType = 'on_field' | 'off_field';

export interface ExerciseMedia {
  type: 'image' | 'video';
  path: string;
  url: string;
}

export interface Exercise {
  id: string;
  title: string;
  learning_content: string | null;
  description: string | null;
  variants: string | null;
  focus_areas: ExerciseFocus[];
  age_category_ids: string[];
  media: ExerciseMedia[];
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Training {
  id: string;
  team_id: string;
  date: string;
  start_time: string | null;
  duration_minutes: number;
  series_id: string | null;
  field_type: TrainingFieldType;
  notes: string | null;
  information: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingExercise {
  id: string;
  training_id: string;
  exercise_id: string;
  duration_minutes: number;
  notes: string | null;
  sort_order: number;
}

export interface TrainingAbsence {
  id: string;
  training_id: string;
  person_type: 'player' | 'trainer';
  player_id: string | null;
  trainer_id: string | null;
}

export interface TrainingTrainer {
  training_id: string;
  trainer_id: string;
}

export interface TrainingRating {
  id: string;
  training_id: string;
  stars: number;
  notes: string | null;
  created_by: string | null;
  is_admin_feedback: boolean;
  created_at: string;
}

export type GameLineupPosition = 'goalie' | 'defense' | 'wing' | 'center' | 'field';

export interface Game {
  id: string;
  category_id: string | null;
  our_team_id: string | null;
  date: string;
  time: string | null;
  location: string | null;
  home_team: string;
  away_team: string;
  season: string | null;
  result_us: number | null;
  result_them: number | null;
  pre_game_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameLineup {
  id: string;
  game_id: string;
  player_id: string;
  block_number: number | null;
  position: GameLineupPosition | null;
}

export interface GameAbsence {
  id: string;
  game_id: string;
  person_type: 'player' | 'trainer';
  player_id: string | null;
  trainer_id: string | null;
}

export type GameRatingCategory =
  | 'goalie'
  | 'defense'
  | 'offense'
  | 'powerplay'
  | 'boxplay'
  | 'overall';

export interface GameRating {
  id: string;
  game_id: string;
  category: GameRatingCategory;
  stars: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PlayerGameComment {
  id: string;
  player_id: string;
  game_id: string | null;
  date: string;
  opponent: string | null;
  note: string;
  created_by: string | null;
  created_at: string;
}

export interface Budget {
  id: string;
  team_id: string;
  season: string;
  amount: number;
  updated_by: string | null;
  updated_at: string;
}

export interface Receipt {
  id: string;
  team_id: string;
  season: string;
  type: 'income' | 'expense';
  amount: number;
  recipient_type: 'company' | 'person';
  recipient_name: string;
  notes: string | null;
  photo_path: string | null;
  date: string;
  created_by: string | null;
  created_at: string;
}

// Minimal-Interface für den typisierten Supabase-Client. Da wir keine
// generierten Typen aus einem Live-Projekt beziehen, halten wir das
// Database-Generic bewusst locker, damit der Client trotzdem mit
// `.from('players')` etc. typsicher an den obigen Interfaces arbeitet.
// Für insert()/update()-Aufrufe reicht die Typinferenz von
// @supabase/postgrest-js über dieses handgeschriebene Schema nicht immer
// aus; an den entsprechenden Stellen wird der Query-Builder dafür gezielt
// mit `as any` entschärft statt das Schema künstlich zu verbiegen.
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      categories: { Row: Category; Insert: Partial<Category>; Update: Partial<Category> };
      teams: { Row: Team; Insert: Partial<Team>; Update: Partial<Team> };
      user_team_roles: {
        Row: UserTeamRole;
        Insert: Partial<UserTeamRole>;
        Update: Partial<UserTeamRole>;
      };
      players: { Row: Player; Insert: Partial<Player>; Update: Partial<Player> };
      player_teams: {
        Row: PlayerTeam;
        Insert: Partial<PlayerTeam>;
        Update: Partial<PlayerTeam>;
      };
      trainers: { Row: Trainer; Insert: Partial<Trainer>; Update: Partial<Trainer> };
      trainer_teams: {
        Row: TrainerTeam;
        Insert: Partial<TrainerTeam>;
        Update: Partial<TrainerTeam>;
      };
      player_notes: {
        Row: PlayerNote;
        Insert: Partial<PlayerNote>;
        Update: Partial<PlayerNote>;
      };
      exercises: { Row: Exercise; Insert: Partial<Exercise>; Update: Partial<Exercise> };
      trainings: { Row: Training; Insert: Partial<Training>; Update: Partial<Training> };
      training_exercises: {
        Row: TrainingExercise;
        Insert: Partial<TrainingExercise>;
        Update: Partial<TrainingExercise>;
      };
      training_ratings: {
        Row: TrainingRating;
        Insert: Partial<TrainingRating>;
        Update: Partial<TrainingRating>;
      };
      training_absences: {
        Row: TrainingAbsence;
        Insert: Partial<TrainingAbsence>;
        Update: Partial<TrainingAbsence>;
      };
      training_trainers: {
        Row: TrainingTrainer;
        Insert: Partial<TrainingTrainer>;
        Update: Partial<TrainingTrainer>;
      };
      games: { Row: Game; Insert: Partial<Game>; Update: Partial<Game> };
      game_lineups: {
        Row: GameLineup;
        Insert: Partial<GameLineup>;
        Update: Partial<GameLineup>;
      };
      game_absences: {
        Row: GameAbsence;
        Insert: Partial<GameAbsence>;
        Update: Partial<GameAbsence>;
      };
      game_ratings: {
        Row: GameRating;
        Insert: Partial<GameRating>;
        Update: Partial<GameRating>;
      };
      player_game_comments: {
        Row: PlayerGameComment;
        Insert: Partial<PlayerGameComment>;
        Update: Partial<PlayerGameComment>;
      };
      budgets: { Row: Budget; Insert: Partial<Budget>; Update: Partial<Budget> };
      receipts: { Row: Receipt; Insert: Partial<Receipt>; Update: Partial<Receipt> };
    };
  };
}
