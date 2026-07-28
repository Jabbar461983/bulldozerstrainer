import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
        variant === 'primary' && 'bg-accent text-accent-foreground hover:brightness-110',
        variant === 'secondary' &&
          'bg-surface-alt text-text border border-border hover:brightness-95',
        variant === 'ghost' && 'text-text hover:bg-surface-alt',
        variant === 'danger' && 'bg-danger text-white hover:brightness-110',
        className,
      )}
      {...props}
    />
  );
}
