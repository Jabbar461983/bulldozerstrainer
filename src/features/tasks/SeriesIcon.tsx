import type { TaskSeries } from '../../types/database';
import { TASK_RECURRENCE_LABELS } from './api';

function formatDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function seriesDescription(series: TaskSeries): string {
  return `Serienaufgabe · ${TASK_RECURRENCE_LABELS[series.recurrence]}${
    series.end_date ? ` bis ${formatDate(series.end_date)}` : ''
  }`;
}

/** Marker für Serienaufgaben: zwei Pfeile im Kreis. */
export function SeriesIcon({ series, className = 'size-4' }: { series: TaskSeries | null; className?: string }) {
  if (!series) return null;
  const label = seriesDescription(series);
  return (
    <span title={label} aria-label={label} role="img" className="inline-flex shrink-0 text-text-muted">
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 11a8 8 0 00-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0014.3 4.9L20 16M20 20v-4h-4" />
      </svg>
    </span>
  );
}
