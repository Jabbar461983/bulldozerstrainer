import type { SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        'min-h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30',
        props.className,
      )}
    />
  );
}
