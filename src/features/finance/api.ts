import { supabase } from '../../lib/supabase';
import type { Budget, Receipt } from '../../types/database';

const RECEIPTS_BUCKET = 'receipts';
const SIGNED_URL_TTL_SECONDS = 3600;

export interface ReceiptRow extends Receipt {
  photoUrl: string | null;
}

export async function fetchBudget(teamId: string, season: string): Promise<Budget | null> {
  const { data, error } = await supabase.from('budgets').select('*').eq('team_id', teamId).eq('season', season);
  if (error) throw error;
  return ((data ?? [])[0] as Budget | undefined) ?? null;
}

export async function upsertBudget(teamId: string, season: string, amount: number, updatedBy: string | null) {
  const existing = await fetchBudget(teamId, season);
  if (existing) {
    const { error } = await (supabase.from('budgets') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .update({ amount, updated_by: updatedBy })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await (supabase.from('budgets') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert({ team_id: teamId, season, amount, updated_by: updatedBy });
    if (error) throw error;
  }
}

async function signReceiptPhotos(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  const map = new Map<string, string>();
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

export async function fetchReceipts(teamId: string, season: string): Promise<ReceiptRow[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('team_id', teamId)
    .eq('season', season)
    .order('date', { ascending: true });
  if (error) throw error;
  const receipts = (data ?? []) as Receipt[];
  const paths = receipts.map((r) => r.photo_path).filter((p): p is string => Boolean(p));
  const urlByPath = await signReceiptPhotos(paths);
  return receipts.map((r) => ({ ...r, photoUrl: r.photo_path ? (urlByPath.get(r.photo_path) ?? null) : null }));
}

export const MAX_RECEIPT_PHOTO_SIZE = 20 * 1024 * 1024;

export async function uploadReceiptPhoto(teamId: string, file: File): Promise<string> {
  if (file.size > MAX_RECEIPT_PHOTO_SIZE) {
    throw new Error(`Datei "${file.name}" ist zu gross (max. 20 MB).`);
  }
  const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined;
  const path = `${teamId}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`;
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}

export async function createReceipt(payload: {
  team_id: string;
  season: string;
  type: 'income' | 'expense';
  amount: number;
  recipient_type: 'company' | 'person';
  recipient_name: string;
  notes: string | null;
  date: string;
  created_by: string | null;
  photoFile: File | null;
}) {
  const { photoFile, ...rest } = payload;
  const photo_path = photoFile ? await uploadReceiptPhoto(payload.team_id, photoFile) : null;
  const { error } = await (supabase.from('receipts') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({ ...rest, photo_path });
  if (error) throw error;
}

export async function updateReceipt(
  id: string,
  updates: Partial<Pick<Receipt, 'type' | 'amount' | 'recipient_type' | 'recipient_name' | 'notes' | 'date'>>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('receipts') as any).update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteReceipt(id: string, photoPath: string | null) {
  const { error } = await supabase.from('receipts').delete().eq('id', id);
  if (error) throw error;
  if (photoPath) await supabase.storage.from(RECEIPTS_BUCKET).remove([photoPath]);
}
