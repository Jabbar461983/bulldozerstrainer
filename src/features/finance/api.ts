import { supabase } from '../../lib/supabase';
import type { Budget, Receipt } from '../../types/database';
import { fetchTeamOptions } from '../../lib/teams';

const RECEIPTS_BUCKET = 'receipts';
const SIGNED_URL_TTL_SECONDS = 3600;
const CLUB_STORAGE_PREFIX = 'verein';

export interface ReceiptRow extends Receipt {
  photoUrl: string | null;
}

/** team_id = null steht für den Verein (Belege/Budget unabhängig von einem Team, nur Admin). */
function filterByTeam<T extends { eq: (col: string, val: string) => T; is: (col: string, val: null) => T }>(
  query: T,
  teamId: string | null,
): T {
  return teamId === null ? query.is('team_id', null) : query.eq('team_id', teamId);
}

export async function fetchBudget(teamId: string | null, season: string): Promise<Budget | null> {
  const { data, error } = await filterByTeam(supabase.from('budgets').select('*'), teamId).eq('season', season);
  if (error) throw error;
  return ((data ?? [])[0] as Budget | undefined) ?? null;
}

export async function upsertBudget(
  teamId: string | null,
  season: string,
  amount: number,
  updatedBy: string | null,
) {
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

export interface TeamFinanceSummary {
  teamId: string | null;
  teamName: string;
  categoryName: string;
  budget: number;
  income: number;
  expense: number;
  saldo: number;
}

/** Gesamtübersicht für Admin: alle Teams plus der Verein (team_id null), je mit Budget/Einnahmen/Ausgaben/Saldo. */
export async function fetchFinanceOverview(season: string): Promise<TeamFinanceSummary[]> {
  const [teamOptions, { data: budgetRows, error: budgetsError }, { data: receiptRows, error: receiptsError }] =
    await Promise.all([
      fetchTeamOptions(),
      supabase.from('budgets').select('team_id, amount').eq('season', season),
      supabase.from('receipts').select('team_id, type, amount').eq('season', season),
    ]);
  if (budgetsError) throw budgetsError;
  if (receiptsError) throw receiptsError;

  const budgetByTeam = new Map<string | null, number>(
    (budgetRows ?? []).map((b: { team_id: string | null; amount: number }) => [b.team_id, b.amount]),
  );
  const sumsByTeam = new Map<string | null, { income: number; expense: number }>();
  for (const r of (receiptRows ?? []) as { team_id: string | null; type: 'income' | 'expense'; amount: number }[]) {
    const sums = sumsByTeam.get(r.team_id) ?? { income: 0, expense: 0 };
    if (r.type === 'income') sums.income += r.amount;
    else sums.expense += r.amount;
    sumsByTeam.set(r.team_id, sums);
  }

  function buildRow(teamId: string | null, teamName: string, categoryName: string): TeamFinanceSummary {
    const budget = budgetByTeam.get(teamId) ?? 0;
    const sums = sumsByTeam.get(teamId) ?? { income: 0, expense: 0 };
    return {
      teamId,
      teamName,
      categoryName,
      budget,
      income: sums.income,
      expense: sums.expense,
      saldo: budget + sums.income - sums.expense,
    };
  }

  return [
    ...teamOptions.map((t) => buildRow(t.teamId, t.teamName, t.categoryName)),
    buildRow(null, 'Verein (kein Team)', ''),
  ];
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

export async function fetchReceipts(teamId: string | null, season: string): Promise<ReceiptRow[]> {
  const { data, error } = await filterByTeam(supabase.from('receipts').select('*'), teamId)
    .eq('season', season)
    .order('date', { ascending: true });
  if (error) throw error;
  const receipts = (data ?? []) as Receipt[];
  const paths = receipts.map((r) => r.photo_path).filter((p): p is string => Boolean(p));
  const urlByPath = await signReceiptPhotos(paths);
  return receipts.map((r) => ({ ...r, photoUrl: r.photo_path ? (urlByPath.get(r.photo_path) ?? null) : null }));
}

export const MAX_RECEIPT_PHOTO_SIZE = 20 * 1024 * 1024;

export async function uploadReceiptPhoto(teamId: string | null, file: File): Promise<string> {
  if (file.size > MAX_RECEIPT_PHOTO_SIZE) {
    throw new Error(`Datei "${file.name}" ist zu gross (max. 20 MB).`);
  }
  const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined;
  const path = `${teamId ?? CLUB_STORAGE_PREFIX}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`;
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}

export async function createReceipt(payload: {
  team_id: string | null;
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
