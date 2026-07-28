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

  return (
    <div className="flex min-h-full flex-col bg-bg text-text">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-2">
          <img src="/logo-bulldozers_farbig.png" alt="Bulldozers" className="size-9 object-contain" />
          <span className="text-sm font-semibold sm:text-base">Bulldozers Junioren Manager</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => void signOut()}
            className="hidden min-h-11 items-center rounded-xl border border-border px-3 text-sm text-text-muted hover:bg-surface-alt sm:flex"
          >
            Abmelden
          </button>
        </div>
      </header>

      {!isOnline && (
        <div className="bg-warning/10 px-4 py-1.5 text-center text-xs font-medium text-warning">
          Offline – es werden zuletzt geladene Daten angezeigt.
        </div>
      )}

      <div className="flex flex-1">
        {/* Desktop-Sidebar */}
        <nav className="hidden w-56 shrink-0 border-r border-border p-3 sm:block">
          <p className="mb-3 px-2 text-xs font-medium text-text-muted">
            {profile ? `${profile.first_name} ${profile.last_name}` : ''}
          </p>
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
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
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted hover:bg-surface-alt"
          >
            Abmelden
          </button>
        </nav>

        <main className="flex-1 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-6">
          <div className="mx-auto max-w-4xl p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom-Nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {mobileMainItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                isActive ? 'text-accent' : 'text-text-muted',
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
        {showOverflow && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-text-muted"
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
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
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
