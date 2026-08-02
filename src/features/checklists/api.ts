import { supabase } from '../../lib/supabase';
import type {
  Checklist,
  ChecklistItem,
  ChecklistInstance,
  ChecklistItemCompletion,
} from '../../types/database';

export interface ChecklistRow extends Checklist {
  items: ChecklistItem[];
  teamIds: string[];
}

export interface ChecklistInstanceRow extends ChecklistInstance {
  checklistTitle: string;
  teamName: string | null;
  items: ChecklistItem[];
  completions: Record<string, ChecklistItemCompletion | undefined>;
  progress: { total: number; completed: number };
}

export async function fetchChecklists(): Promise<ChecklistRow[]> {
  const [
    { data: checklists, error: checklistsError },
    { data: items, error: itemsError },
    { data: teams, error: teamsError },
  ] = await Promise.all([
    supabase.from('checklists').select('*').order('created_at', { ascending: false }),
    supabase.from('checklist_items').select('*').order('sort_order', { ascending: true }),
    supabase.from('checklist_teams').select('*'),
  ]);

  if (checklistsError) throw checklistsError;
  if (itemsError) throw itemsError;
  if (teamsError) throw teamsError;

  const itemsByChecklistId = new Map<string, ChecklistItem[]>();
  (items ?? []).forEach((item: any) => {
    if (!itemsByChecklistId.has(item.checklist_id)) {
      itemsByChecklistId.set(item.checklist_id, []);
    }
    itemsByChecklistId.get(item.checklist_id)!.push(item);
  });

  const teamsByChecklistId = new Map<string, string[]>();
  (teams ?? []).forEach((team: any) => {
    if (!teamsByChecklistId.has(team.checklist_id)) {
      teamsByChecklistId.set(team.checklist_id, []);
    }
    teamsByChecklistId.get(team.checklist_id)!.push(team.team_id);
  });

  return (checklists ?? []).map((checklist: any) => ({
    ...checklist,
    items: itemsByChecklistId.get(checklist.id) ?? [],
    teamIds: teamsByChecklistId.get(checklist.id) ?? [],
  }));
}

export async function createChecklist(payload: {
  title: string;
  description: string | null;
  has_reporting: boolean;
  is_global: boolean;
}) {
  const { data, error } = await (supabase.from('checklists') as any)
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateChecklist(
  id: string,
  updates: Partial<Pick<Checklist, 'title' | 'description' | 'has_reporting' | 'is_global'>>,
) {
  const { error } = await (supabase.from('checklists') as any)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteChecklist(id: string) {
  const { error } = await supabase.from('checklists').delete().eq('id', id);
  if (error) throw error;
}

export async function updateChecklistTeamAssignments(id: string, teamIds: string[]) {
  const { error: deleteError } = await supabase.from('checklist_teams').delete().eq('checklist_id', id);
  if (deleteError) throw deleteError;

  if (teamIds.length === 0) return;

  const rows = teamIds.map((teamId) => ({ checklist_id: id, team_id: teamId }));
  const { error: insertError } = await (supabase.from('checklist_teams') as any).insert(rows);
  if (insertError) throw insertError;
}

export async function createChecklistItem(payload: { checklist_id: string; title: string }) {
  const { error } = await (supabase.from('checklist_items') as any).insert(payload);
  if (error) throw error;
}

export async function deleteChecklistItem(id: string) {
  const { error } = await supabase.from('checklist_items').delete().eq('id', id);
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function reorderChecklistItems(
  _checklistId: string,
  items: { id: string; sort_order: number }[],
) {
  for (const item of items) {
    const { error } = await (supabase.from('checklist_items') as any)
      .update({ sort_order: item.sort_order })
      .eq('id', item.id);
    if (error) throw error;
  }
}

export async function fetchChecklistInstances(checklistId: string): Promise<ChecklistInstanceRow[]> {
  const [
    { data: instances, error: instancesError },
    { data: checklist, error: checklistError },
    { data: items, error: itemsError },
    { data: completions, error: completionsError },
    { data: teams, error: teamsError },
  ] = await Promise.all([
    supabase.from('checklist_instances').select('*').eq('checklist_id', checklistId),
    supabase.from('checklists').select('title').eq('id', checklistId).single(),
    supabase.from('checklist_items').select('*').eq('checklist_id', checklistId),
    supabase.from('checklist_item_completions').select('*'),
    supabase.from('teams').select('id, name'),
  ]);

  if (instancesError) throw instancesError;
  if (checklistError) throw checklistError;
  if (itemsError) throw itemsError;
  if (completionsError) throw completionsError;
  if (teamsError) throw teamsError;

  const teamById = new Map((teams ?? []).map((t: any) => [t.id, t.name]));

  return (instances ?? []).map((instance: any) => {
    const itemsByInstance = (completions ?? [])
      .filter((c: any) => c.checklist_instance_id === instance.id)
      .reduce((acc: Record<string, any>, c: any) => {
        acc[c.checklist_item_id] = c;
        return acc;
      }, {});

    const completed = Object.keys(itemsByInstance).length;
    const total = (items ?? []).length;

    return {
      ...instance,
      checklistTitle: (checklist as any)?.title ?? 'Unbekannt',
      teamName: instance.team_id ? teamById.get(instance.team_id) ?? null : null,
      items: (items ?? []) as ChecklistItem[],
      completions: itemsByInstance,
      progress: { total, completed },
    };
  });
}

export async function createChecklistInstance(payload: {
  checklist_id: string;
  team_id: string | null;
  event_date: string | null;
  event_context: string | null;
}) {
  const { error } = await (supabase.from('checklist_instances') as any).insert(payload);
  if (error) throw error;
}

export async function updateChecklistInstance(
  id: string,
  updates: Partial<Pick<ChecklistInstance, 'event_date' | 'event_context'>>,
) {
  const { error } = await (supabase.from('checklist_instances') as any).update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteChecklistInstance(id: string) {
  const { error } = await supabase.from('checklist_instances').delete().eq('id', id);
  if (error) throw error;
}

export async function toggleChecklistItem(payload: {
  instance_id: string;
  item_id: string;
  notes: string;
}) {
  const { data: existing, error: fetchError } = await supabase
    .from('checklist_item_completions')
    .select('id')
    .eq('checklist_instance_id', payload.instance_id)
    .eq('checklist_item_id', payload.item_id)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from('checklist_item_completions')
      .delete()
      .eq('id', (existing as any).id);
    if (deleteError) throw deleteError;
  } else {
    const { error: insertError } = await (supabase.from('checklist_item_completions') as any).insert({
      checklist_instance_id: payload.instance_id,
      checklist_item_id: payload.item_id,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      notes: payload.notes || null,
    });
    if (insertError) throw insertError;
  }
}

export async function getChecklistProgress(
  instanceId: string,
): Promise<{ total: number; completed: number; pending: number }> {
  const instanceData = await supabase.from('checklist_instances').select('checklist_id').eq('id', instanceId).single();

  const [
    { data: items, error: itemsError },
    { data: completions, error: completionsError },
  ] = await Promise.all([
    supabase
      .from('checklist_items')
      .select('id')
      .eq('checklist_id', (instanceData.data as any)?.checklist_id),
    supabase.from('checklist_item_completions').select('id').eq('checklist_instance_id', instanceId),
  ]);

  if (itemsError) throw itemsError;
  if (completionsError) throw completionsError;

  const total = (items ?? []).length;
  const completed = (completions ?? []).length;

  return { total, completed, pending: total - completed };
}
