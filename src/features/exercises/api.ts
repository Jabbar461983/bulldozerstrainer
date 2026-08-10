import { supabase } from '../../lib/supabase';
import type { Exercise, ExerciseFocus, ExerciseMedia } from '../../types/database';

export const ON_FIELD_FOCUS_OPTIONS: ExerciseFocus[] = [
  'Offensivverhalten',
  'Schuss',
  'Passen',
  'Aufbau',
  'Ballabdecken',
  'Lösen vom Gegner',
  'Zweikampf',
  'Bullys',
  'Überzahlsituation',
  'Specialteams',
  'Torhüter',
  'Minigames',
  'Spiel',
];

export const OFF_FIELD_FOCUS_OPTIONS: ExerciseFocus[] = [
  'Kraft',
  'Ausdauer',
  'Koordination',
  'Schnelligkeit',
  'Off Field Spiel',
];

export const EXERCISE_FOCUS_OPTIONS: ExerciseFocus[] = [...ON_FIELD_FOCUS_OPTIONS, ...OFF_FIELD_FOCUS_OPTIONS];

export const MAX_MEDIA_FILE_SIZE = 50 * 1024 * 1024;

const MEDIA_BUCKET = 'exercise-media';
const SIGNED_URL_TTL_SECONDS = 3600;

export interface ExerciseOption {
  id: string;
  title: string;
  age_category_ids: string[];
  focus_areas: ExerciseFocus[];
}

export async function fetchExerciseOptions(): Promise<ExerciseOption[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, title, age_category_ids, focus_areas')
    .order('title', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface ExerciseMediaView {
  type: 'image' | 'video';
  path: string;
  url: string | null;
}

export interface ExerciseRow extends Omit<Exercise, 'media'> {
  media: ExerciseMediaView[];
}

async function signMediaPaths(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  const urlByPath = new Map<string, string>();
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) urlByPath.set(entry.path, entry.signedUrl);
  }
  return urlByPath;
}

function toRows(exercises: Exercise[], urlByPath: Map<string, string>): ExerciseRow[] {
  return exercises.map((exercise) => ({
    ...exercise,
    media: exercise.media.map((m) => ({ type: m.type, path: m.path, url: urlByPath.get(m.path) ?? null })),
  }));
}

export async function fetchExercise(id: string): Promise<ExerciseRow> {
  const { data, error } = await supabase.from('exercises').select('*').eq('id', id);
  if (error) throw error;
  const exercise = (data ?? [])[0] as Exercise | undefined;
  if (!exercise) throw new Error('Übung nicht gefunden.');
  const urlByPath = await signMediaPaths(exercise.media.map((m) => m.path));
  return toRows([exercise], urlByPath)[0];
}

export async function fetchExercises(): Promise<ExerciseRow[]> {
  const { data, error } = await supabase.from('exercises').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const exercises = (data ?? []) as Exercise[];
  const allPaths = exercises.flatMap((exercise) => exercise.media.map((m) => m.path));
  const urlByPath = await signMediaPaths(allPaths);
  return toRows(exercises, urlByPath);
}

export async function fetchExerciseMediaByIds(ids: string[]): Promise<Map<string, ExerciseMediaView[]>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('exercises').select('id, media').in('id', ids);
  if (error) throw error;
  const exercises = (data ?? []) as { id: string; media: ExerciseMedia[] }[];
  const allPaths = exercises.flatMap((e) => e.media.map((m) => m.path));
  const urlByPath = await signMediaPaths(allPaths);
  const result = new Map<string, ExerciseMediaView[]>();
  for (const e of exercises) {
    result.set(
      e.id,
      e.media.map((m) => ({ type: m.type, path: m.path, url: urlByPath.get(m.path) ?? null })),
    );
  }
  return result;
}

// Speichernamen sollen den Übungstitel enthalten, damit Dateien im Storage-
// Bucket auch ohne Datenbankzugriff erkennbar sind. Zeichen, die in
// Speicherpfaden problematisch sind, werden entfernt; Umlaute bleiben erhalten.
function sanitizeForFilename(title: string): string {
  const cleaned = title
    .replace(/[/\\:*?"<>|#%«»]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  return cleaned.slice(0, 80) || 'uebung';
}

export async function uploadExerciseMedia(exerciseId: string, title: string, files: File[]): Promise<ExerciseMedia[]> {
  const uploaded: ExerciseMedia[] = [];
  const titlePart = sanitizeForFilename(title);
  for (const file of files) {
    if (file.size > MAX_MEDIA_FILE_SIZE) {
      throw new Error(`Datei "${file.name}" ist zu gross (max. 50 MB).`);
    }
    const type: ExerciseMedia['type'] = file.type.startsWith('video/') ? 'video' : 'image';
    const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined;
    const path = `${exerciseId}/${titlePart}-${crypto.randomUUID()}${extension ? `.${extension}` : ''}`;
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file);
    if (error) throw error;
    uploaded.push({ type, path, url: '' });
  }
  return uploaded;
}

export async function removeExerciseMediaFile(path: string) {
  await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}

export async function createExercise(payload: {
  title: string;
  learning_content: string | null;
  description: string | null;
  variants: string | null;
  focus_areas: ExerciseFocus[];
  age_category_ids: string[];
  files: File[];
  author_id: string | null;
}) {
  const { files, ...exercisePayload } = payload;
  const { data, error } = await (supabase.from('exercises') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({ ...exercisePayload, media: [] })
    .select('id')
    .single();
  if (error) throw error;

  if (files.length > 0) {
    const media = await uploadExerciseMedia(data.id, payload.title, files);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: mediaError } = await (supabase.from('exercises') as any).update({ media }).eq('id', data.id);
    if (mediaError) throw mediaError;
  }
}

export interface ExerciseImportPayload {
  title: string;
  learning_content: string | null;
  description: string | null;
  variants: string | null;
  focus_areas: ExerciseFocus[];
  age_category_ids: string[];
}

export async function importExercises(payloads: ExerciseImportPayload[], authorId: string | null) {
  for (const payload of payloads) {
    await createExercise({ ...payload, files: [], author_id: authorId });
  }
}

export async function updateExercise(
  id: string,
  updates: Partial<
    Pick<Exercise, 'title' | 'learning_content' | 'description' | 'variants' | 'focus_areas' | 'age_category_ids'>
  >,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('exercises') as any).update(updates).eq('id', id);
  if (error) throw error;
}

export async function addExerciseMedia(exerciseId: string, title: string, existingMedia: ExerciseMedia[], files: File[]) {
  const newMedia = await uploadExerciseMedia(exerciseId, title, files);
  const media = [...existingMedia, ...newMedia];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('exercises') as any).update({ media }).eq('id', exerciseId);
  if (error) throw error;
}

export async function removeExerciseMedia(exerciseId: string, existingMedia: ExerciseMedia[], path: string) {
  const media = existingMedia.filter((m) => m.path !== path);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('exercises') as any).update({ media }).eq('id', exerciseId);
  if (error) throw error;
  await removeExerciseMediaFile(path);
}

export async function deleteExercise(id: string, media: ExerciseMedia[]) {
  const { error } = await supabase.from('exercises').delete().eq('id', id);
  if (error) throw error;
  await Promise.all(media.map((m) => removeExerciseMediaFile(m.path)));
}
