import type { SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        'ui-select min-h-11 w-full min-w-0 truncate rounded-md border border-border-strong bg-surface py-2 pl-3 pr-9 text-base text-text outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15',
        props.className,
      )}
    />
  );
}
