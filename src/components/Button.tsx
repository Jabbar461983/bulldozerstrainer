import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

/** Einheitliche Button-Optik - auch für Links, die wie Buttons aussehen sollen. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return clsx(
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border font-semibold transition-colors disabled:cursor-default disabled:opacity-45',
    size === 'md' && 'min-h-11 px-4 text-sm sm:min-h-10',
    size === 'sm' && 'min-h-9 px-3 text-[13px] sm:min-h-8',
    variant === 'primary' && 'border-transparent bg-accent text-accent-foreground enabled:hover:bg-accent-hover',
    variant === 'secondary' && 'border-border-strong bg-surface text-text enabled:hover:border-text',
    variant === 'ghost' && 'border-transparent bg-transparent text-text-muted enabled:hover:bg-surface-alt enabled:hover:text-text',
    variant === 'danger' &&
      'border-border-strong bg-surface text-danger enabled:hover:border-danger enabled:hover:bg-danger enabled:hover:text-white',
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Navigations-Link in Button-Optik (statt <Link><Button/></Link>). */
export function LinkButton({ variant = 'secondary', size = 'md', className, ...props }: LinkButtonProps) {
  return (
    <Link
      className={clsx(
        buttonClasses(variant, size, className),
        variant === 'primary' && 'hover:bg-accent-hover',
        variant === 'secondary' && 'hover:border-text',
      )}
      {...props}
    />
  );
}

/** "Zurück"-Button mit Pfeil, überall gleich. */
export function BackLinkButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <LinkButton to={to} variant="secondary">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      {children}
    </LinkButton>
  );
}
