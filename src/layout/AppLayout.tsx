import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import type { Module } from '../auth/permissions';

interface NavItem {
  to: string;
  label: string;
  module?: Module;
  adminOnly?: boolean;
  icon: ReactNode;
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Start', icon: <Icon d="M3 11.5L12 4l9 7.5M5 10v9h5v-5h4v5h5v-9" /> },
  {
    to: '/training',
    label: 'Training',
    module: 'training',
    icon: <Icon d="M4 20l6-6m0 0l4-9 6 6-9 4-1 5zm6-6l4 4" />,
  },
  {
    to: '/spiele',
    label: 'Spiele',
    module: 'spiele',
    icon: <Icon d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 0v18M3.6 8.5h16.8M3.6 15.5h16.8" />,
  },
  {
    to: '/spieler',
    label: 'Spieler',
    module: 'spieler',
    icon: <Icon d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0" />,
  },
  {
    to: '/trainer',
    label: 'Trainer',
    module: 'trainer',
    icon: <Icon d="M4 20a5 5 0 0110-.2M9 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm10 8v-2a3 3 0 00-2.3-2.9M15 5.1a3 3 0 010 5.8" />,
  },
  {
    to: '/uebungen',
    label: 'Übungen',
    module: 'uebungen',
    icon: <Icon d="M6 4h9l3 3v13H6zM9 9h6M9 13h6M9 17h4" />,
  },
  {
    to: '/finanzen',
    label: 'Finanzen',
    module: 'finanzen',
    icon: <Icon d="M3 7h18M3 7v11a1 1 0 001 1h16a1 1 0 001-1V7M7 12h4M3 7l2-4h14l2 4" />,
  },
  {
    to: '/teams',
    label: 'Teams',
    adminOnly: true,
    icon: <Icon d="M4 20a4 4 0 018 0M12 20a4 4 0 018 0M8 12a3 3 0 100-6 3 3 0 000 6zm8 0a3 3 0 100-6 3 3 0 000 6z" />,
  },
  {
    to: '/benutzer',
    label: 'Benutzer',
    adminOnly: true,
    icon: <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21a8 8 0 0116 0" />,
  },
];

export function AppLayout() {
  const { profile, isAdmin, canAccess, signOut } = useAuth();

  const items = NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return isAdmin;
    if (item.module) return canAccess(item.module);
    return true;
  });

  return (
    <div className="flex min-h-full flex-col bg-bg text-text">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Bulldozers" className="size-9" />
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

        <main className="flex-1 overflow-y-auto pb-24 sm:pb-6">
          <div className="mx-auto max-w-4xl p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom-Nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface/95 backdrop-blur sm:hidden">
        {items.slice(0, 5).map((item) => (
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
      </nav>
    </div>
  );
}
