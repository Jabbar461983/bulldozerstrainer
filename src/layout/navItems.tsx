import type { ReactNode } from 'react';
import type { Module } from '../auth/permissions';

export interface NavItem {
  to: string;
  label: string;
  module?: Module;
  adminOnly?: boolean;
  icon: ReactNode;
}

export function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Start', icon: <Icon d="M3 11.5L12 4l9 7.5M5 10v9h5v-5h4v5h5v-9" /> },
  {
    to: '/training',
    label: 'Training',
    module: 'training',
    icon: <Icon d="M4 20l6-6m0 0l4-9 6 6-9 4-1 5zm6-6l4 4" />,
  },
  {
    to: '/saisonplanung',
    label: 'Saisonplanung',
    module: 'training',
    icon: <Icon d="M3 6h18M3 6v12a1 1 0 001 1h16a1 1 0 001-1V6M3 9h18M7 12h10M7 15h10" />,
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
    adminOnly: true,
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
    label: 'Teamverwaltung',
    adminOnly: true,
    icon: <Icon d="M4 20a4 4 0 018 0M12 20a4 4 0 018 0M8 12a3 3 0 100-6 3 3 0 000 6zm8 0a3 3 0 100-6 3 3 0 000 6z" />,
  },
  {
    to: '/checklisten',
    label: 'Checklisten',
    module: 'checklisten',
    icon: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 15h6" />,
  },
  {
    to: '/checklisten-verwaltung',
    label: 'Checklisten-Verwaltung',
    adminOnly: true,
    icon: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 15h6" />,
  },
  {
    to: '/benutzer',
    label: 'Benutzer',
    adminOnly: true,
    icon: <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21a8 8 0 0116 0" />,
  },
];
