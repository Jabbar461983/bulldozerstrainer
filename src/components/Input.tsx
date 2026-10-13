import type { InputHTMLAttributes, LabelHTMLAttributes } from 'react';
import clsx from 'clsx';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'min-h-11 w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-text outline-none transition placeholder:text-text-muted/70 focus:border-accent focus:ring-3 focus:ring-accent/15',
        props.className,
      )}
    />
  );
}

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={clsx('mb-1.5 block text-xs font-semibold tracking-wide text-text-muted', props.className)}
    />
  );
}
