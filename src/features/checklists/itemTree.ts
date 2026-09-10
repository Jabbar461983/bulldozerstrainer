import type { ChecklistItem } from '../../types/database';

export interface ChecklistItemNode {
  item: ChecklistItem;
  depth: number;
}

// Baut aus der flachen Item-Liste eine hierarchisch gruppierte
// Anzeige-Reihenfolge: jede Überschrift wird direkt von ihren Unterpunkten
// gefolgt (rekursiv über beliebig viele Ebenen), statt rein nach dem
// gespeicherten sort_order über alle Items hinweg sortiert zu werden. Die
// Gruppierung erfolgt ausschliesslich über parent_id - sort_order bestimmt
// nur die Reihenfolge innerhalb einer Geschwistergruppe (gleicher
// parent_id). Das macht die Darstellung robust, selbst wenn für ältere
// Items nie ein sinnvoller sort_order gesetzt wurde.
export function buildChecklistItemTree(items: ChecklistItem[]): ChecklistItemNode[] {
  const byParent = new Map<string | null, ChecklistItem[]>();
  for (const item of items) {
    const list = byParent.get(item.parent_id);
    if (list) list.push(item);
    else byParent.set(item.parent_id, [item]);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sort_order - b.sort_order);

  const result: ChecklistItemNode[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const item of byParent.get(parentId) ?? []) {
      result.push({ item, depth });
      if (item.is_section) walk(item.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}

/** Geschwister (gleicher parent_id), sortiert nach sort_order. */
export function siblingsOf(items: ChecklistItem[], parentId: string | null): ChecklistItem[] {
  return items.filter((i) => i.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);
}

/** Nächster freier sort_order-Wert, um ein neues Item am Ende seiner Geschwistergruppe anzuhängen. */
export function nextSortOrder(items: ChecklistItem[], parentId: string | null): number {
  const siblings = siblingsOf(items, parentId);
  return siblings.length === 0 ? 0 : siblings[siblings.length - 1].sort_order + 1;
}
