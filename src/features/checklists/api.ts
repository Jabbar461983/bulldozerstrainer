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
  auto_create_for_home_games?: boolean;
}) {
  const { data, error } = await (supabase.from('checklists') as any)
    .insert({
      ...payload,
      auto_create_for_home_games: payload.auto_create_for_home_games ?? false,
    })
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

export async function duplicateChecklist(id: string): Promise<string> {
  const checklist = await fetchChecklists();
  const original = checklist.find((c) => c.id === id);
  if (!original) throw new Error('Checklist not found');

  const newChecklistId = await createChecklist({
    title: `${original.title} (Kopie)`,
    description: original.description,
    has_reporting: original.has_reporting,
    is_global: original.is_global,
    auto_create_for_home_games: original.auto_create_for_home_games,
  });

  const { error: itemsError } = await (supabase.from('checklist_items') as any).insert(
    original.items.map((item: any) => ({
      checklist_id: newChecklistId,
      title: item.title,
      section_title: item.section_title,
      sort_order: item.sort_order,
      is_heading: item.is_heading,
    }))
  );
  if (itemsError) throw itemsError;

  if (original.teamIds.length > 0) {
    await updateChecklistTeamAssignments(newChecklistId, original.teamIds);
  }

  return newChecklistId;
}

export async function updateChecklistTeamAssignments(id: string, teamIds: string[]) {
  const { error: deleteError } = await supabase.from('checklist_teams').delete().eq('checklist_id', id);
  if (deleteError) throw deleteError;

  if (teamIds.length === 0) return;

  const rows = teamIds.map((teamId) => ({ checklist_id: id, team_id: teamId }));
  const { error: insertError } = await (supabase.from('checklist_teams') as any).insert(rows);
  if (insertError) throw insertError;
}

export async function createChecklistItem(payload: {
  checklist_id: string;
  title: string;
  parent_id?: string | null;
}) {
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
    supabase.from('checklist_instances').select('*').eq('checklist_id', checklistId).is('archived_at', null),
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

export async function fetchArchivedChecklistInstances(checklistId: string): Promise<ChecklistInstanceRow[]> {
  const [
    { data: instances, error: instancesError },
    { data: checklist, error: checklistError },
    { data: items, error: itemsError },
    { data: completions, error: completionsError },
    { data: teams, error: teamsError },
  ] = await Promise.all([
    supabase.from('checklist_instances').select('*').eq('checklist_id', checklistId).not('archived_at', 'is', null),
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
      notes: null,
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

export async function saveChecklistCompletion(payload: {
  instance_id: string;
  notes: string;
}) {
  const { data: instance, error: instanceError } = await supabase
    .from('checklist_instances')
    .select('checklist_id')
    .eq('id', payload.instance_id)
    .single();

  if (instanceError) throw instanceError;

  const [
    { data: items, error: itemsError },
    { data: completions, error: completionsError },
  ] = await Promise.all([
    supabase
      .from('checklist_items')
      .select('id')
      .eq('checklist_id', (instance as any)?.checklist_id),
    supabase.from('checklist_item_completions').select('id').eq('checklist_instance_id', payload.instance_id),
  ]);

  if (itemsError) throw itemsError;
  if (completionsError) throw completionsError;

  const total = (items ?? []).length;
  const completed = (completions ?? []).length;

  if (completed < total) {
    throw new Error(`Noch ${total - completed} von ${total} Punkte offen`);
  }

  const { error: updateError } = await (supabase.from('checklist_instances') as any)
    .update({
      notes: payload.notes || null,
      completed_at: new Date().toISOString(),
      completed_by: (await supabase.auth.getUser()).data.user?.id,
      archived_at: new Date().toISOString(),
    })
    .eq('id', payload.instance_id);

  if (updateError) throw updateError;
}

export async function createChecklistInstancesForHomeGames(checklistId: string, teamIds: string[]): Promise<void> {
  const { data: checklist, error: checklistError } = await supabase
    .from('checklists')
    .select('auto_create_for_home_games')
    .eq('id', checklistId)
    .single();

  if (checklistError) throw checklistError;
  if (!(checklist as any).auto_create_for_home_games) return;

  // Find all future home games for the assigned teams that don't already have instances
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, our_team_id, date')
    .eq('is_home', true)
    .in('our_team_id', teamIds)
    .gte('date', new Date().toISOString().split('T')[0]);

  if (gamesError) throw gamesError;

  if (!games || games.length === 0) return;

  // For each game, create an instance if one doesn't already exist
  for (const game of games) {
    const { data: existingInstances, error: instanceCheckError } = await supabase
      .from('checklist_instances')
      .select('id', { count: 'exact' })
      .eq('checklist_id', checklistId)
      .eq('team_id', (game as any).our_team_id)
      .eq('event_date', (game as any).date);

    if (instanceCheckError) throw instanceCheckError;

    // Only create if no instance exists for this team on this date
    if (!existingInstances || existingInstances.length === 0) {
      await createChecklistInstance({
        checklist_id: checklistId,
        team_id: (game as any).our_team_id,
        event_date: (game as any).date,
        event_context: null,
      });
    }
  }
}

export async function uploadChecklistItemAttachment(
  itemId: string,
  file: File,
): Promise<string> {
  const fileName = `${Date.now()}_${file.name}`;
  const filePath = `checklist-attachments/${itemId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('uploads')
    .upload(filePath, file, { upsert: false });

  if (uploadError) throw uploadError;

  // Store metadata in database
  const { error: dbError } = await (supabase.from('checklist_item_attachments') as any).insert({
    checklist_item_id: itemId,
    file_name: file.name,
    file_path: filePath,
    file_type: file.type,
    file_size: file.size,
    uploaded_by: (await supabase.auth.getUser()).data.user?.id,
  });

  if (dbError) throw dbError;
  return filePath;
}

export async function fetchChecklistItemAttachments(
  itemId: string,
): Promise<{ id: string; fileName: string; fileType: string; fileSize: number; fileUrl: string; uploadedAt: string }[]> {
  const { data, error } = await supabase
    .from('checklist_item_attachments')
    .select('id, file_name, file_type, file_size, file_path, created_at')
    .eq('checklist_item_id', itemId);

  if (error) throw error;

  return (data ?? []).map((att: any) => {
    const { data: signedUrl } = supabase.storage
      .from('uploads')
      .getPublicUrl(att.file_path);

    return {
      id: att.id,
      fileName: att.file_name,
      fileType: att.file_type,
      fileSize: att.file_size,
      fileUrl: signedUrl.publicUrl,
      uploadedAt: att.created_at,
    };
  });
}

export async function deleteChecklistItemAttachment(attachmentId: string): Promise<void> {
  const { data: attachment, error: fetchError } = await supabase
    .from('checklist_item_attachments')
    .select('file_path')
    .eq('id', attachmentId)
    .single();

  if (fetchError) throw fetchError;

  const { error: deleteFileError } = await supabase.storage
    .from('uploads')
    .remove([(attachment as any).file_path]);

  if (deleteFileError) throw deleteFileError;

  const { error: deleteDbError } = await supabase
    .from('checklist_item_attachments')
    .delete()
    .eq('id', attachmentId);

  if (deleteDbError) throw deleteDbError;
}
