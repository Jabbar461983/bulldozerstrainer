import type { HTMLAttributes } from 'react';
import clsx from 'clsx';

/** Liste mit Trennlinien statt einzelner Kästchen. */
export function List({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'min-w-0 divide-y divide-border overflow-hidden rounded-md empty:hidden border border-border bg-surface shadow-[0_1px_2px_rgba(16,24,20,0.05)]',
        className,
      )}
      {...props}
    />
  );
}

/** Zeile einer List; mit onClick wird sie anklickbar (Hover, Cursor, Enter-Taste). */
export function ListRow({ className, onClick, ...props }: HTMLAttributes<HTMLDivElement>) {
  const clickable = Boolean(onClick);
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' && e.target === e.currentTarget) e.currentTarget.click();
            }
          : undefined
      }
      className={clsx(
        'min-w-0 px-4 py-3 transition-colors',
        clickable && 'cursor-pointer hover:bg-surface-alt focus-visible:bg-surface-alt',
        className,
      )}
      {...props}
    />
  );
}

/** Datums-Block links in Listenzeilen (Tag gross, Monat klein). */
export function DateChip({ date }: { date: string }) {
  const d = new Date(`${date}T00:00:00`);
  return (
    <div className="w-11 shrink-0 border-r border-border pr-3 text-center" aria-hidden="true">
      <p className="text-lg font-bold leading-tight text-text tabular-nums">{d.getDate()}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {d.toLocaleDateString('de-CH', { month: 'short' }).replace('.', '')}
      </p>
    </div>
  );
}
