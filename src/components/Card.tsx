import type { HTMLAttributes } from 'react';
import clsx from 'clsx';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'min-w-0 rounded-md border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,20,0.05)] sm:p-5',
        className,
      )}
      {...props}
    />
  );
}
