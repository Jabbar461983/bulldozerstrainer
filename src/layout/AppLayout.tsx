import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { Modal } from '../components/Modal';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { NAV_ITEMS } from './navItems';

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AppLayout() {
  const { profile, isAdmin, canAccess, signOut } = useAuth();
  const isOnline = useOnlineStatus();
  const [showMore, setShowMore] = useState(false);

  const items = NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return isAdmin;
    if (item.module) return canAccess(item.module);
    return true;
  });

  const showOverflow = items.length > 5;
  const mobileMainItems = showOverflow ? items.slice(0, 4) : items;
  const mobileOverflowItems = showOverflow ? items.slice(4) : [];

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'relative flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-gold/15 text-gold before:absolute before:-left-3 before:inset-y-1.5 before:w-[3px] before:rounded-r-sm before:bg-gold'
        : 'text-nav-text hover:bg-nav-hover hover:text-nav-text-strong',
    );

  return (
    <div className="flex min-h-full bg-bg text-text">
      {/* Desktop-Sidebar */}
      <nav className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto bg-nav px-3 py-4 text-nav-text sm:flex">
        <div className="flex items-center gap-2.5 border-b border-nav-border px-1.5 pb-4">
          <img src="/logo-bulldozers_farbig.png" alt="Bulldozers" className="size-10 object-contain" />
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight text-nav-text-strong">Bulldozers</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">Trainer Manager</p>
          </div>
        </div>
        <p className="mt-4 mb-2 truncate px-3 text-xs text-nav-text/70">
          {profile ? `${profile.first_name} ${profile.last_name}` : ''}
        </p>
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.to === '/'} className={navLinkClass}>
                <span className="[&>svg]:size-5">{item.icon}</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center gap-2 border-t border-nav-border pt-3">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex flex-1 items-center gap-3 rounded px-3 py-2 text-sm font-medium text-nav-text transition-colors hover:bg-nav-hover hover:text-nav-text-strong"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
            </svg>
            Abmelden
          </button>
          <ThemeToggle className="flex size-9 items-center justify-center rounded text-nav-text transition-colors hover:bg-nav-hover hover:text-nav-text-strong" />
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Handy-Kopfzeile */}
        <header className="sticky top-0 z-20 flex items-center justify-between bg-nav px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-nav-text-strong sm:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/logo-bulldozers_farbig.png" alt="Bulldozers" className="size-8 object-contain" />
            <span className="truncate text-sm font-semibold">Bulldozers Trainer Manager</span>
          </div>
          <ThemeToggle className="flex size-10 shrink-0 items-center justify-center rounded text-nav-text transition-colors hover:bg-nav-hover hover:text-nav-text-strong" />
        </header>

        {!isOnline && (
          <div className="bg-warning/10 px-4 py-1.5 text-center text-xs font-medium text-warning">
            Offline – es werden zuletzt geladene Daten angezeigt.
          </div>
        )}

        <main className="flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-8">
          <div className="mx-auto max-w-5xl px-4 py-5 sm:px-8 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom-Nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-nav-border bg-nav pb-[env(safe-area-inset-bottom)] sm:hidden">
        {mobileMainItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                isActive ? 'text-gold' : 'text-nav-text',
              )
            }
          >
            {item.icon}
            <span className="max-w-full truncate px-0.5">{item.label}</span>
          </NavLink>
        ))}
        {showOverflow && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-nav-text"
          >
            <MoreIcon />
            Mehr
          </button>
        )}
      </nav>

      {showMore && (
        <Modal title="Mehr" onClose={() => setShowMore(false)}>
          <ul className="flex flex-col gap-1">
            {mobileOverflowItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={() => setShowMore(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent/10 text-accent'
                        : 'text-text-muted hover:bg-surface-alt hover:text-text',
                    )
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
