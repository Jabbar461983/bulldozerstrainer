import clsx from 'clsx';
import type { TaskCategory } from '../../types/database';
import { TASK_CATEGORY_LABELS } from './api';

/** Marker "Sport" (grün) bzw. "Vorstand" (gold). */
export function TaskCategoryBadge({ category }: { category: TaskCategory }) {
  return (
    <span
      className={clsx(
        'rounded px-2 py-0.5 text-xs font-semibold',
        category === 'vorstand' ? 'bg-gold/15 text-gold-text' : 'bg-accent/10 text-accent',
      )}
    >
      {TASK_CATEGORY_LABELS[category] ?? TASK_CATEGORY_LABELS.sport}
    </span>
  );
}
