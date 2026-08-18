import type { CoachRole } from '../types/database';

export type Module = 'finanzen' | 'training' | 'spiele' | 'spieler' | 'uebungen' | 'checklisten';

// Rechtematrix aus dem Konzept: Training/Spiele/Spieler/Übungen für
// Headcoach und Assistenzcoach (jeweils nur im eigenen Team-Scope). Das
// Trainer-Modul (Verwaltung der Trainer-Stammdaten) ist kein team-scoped
// Modul mehr, sondern nur noch für Admins zugänglich (siehe adminOnly-Route
// in App.tsx). Finanzen ist ein Sonderfall (siehe membershipAllowsModule).
const MODULE_ROLES: Record<Exclude<Module, 'finanzen'>, CoachRole[]> = {
  training: ['headcoach', 'assistant_coach'],
  spiele: ['headcoach', 'assistant_coach'],
  spieler: ['headcoach', 'assistant_coach'],
  uebungen: ['headcoach', 'assistant_coach'],
  checklisten: ['headcoach', 'assistant_coach'],
};

export const ROLE_LABELS: Record<CoachRole, string> = {
  headcoach: 'Headcoach',
  assistant_coach: 'Assistenzcoach',
  finance: 'Finanzen',
};

export interface TeamMembership {
  teamId: string;
  role: CoachRole;
  /** Checkbox pro Team-Zuweisung: gewährt Finanzen-Zugriff unabhängig von der Rolle. */
  financeAccess: boolean;
}

// Finanzen ist nicht rein rollenbasiert: die dedizierte Finanzen-Rolle hat
// immer Zugriff, Headcoach/Assistenzcoach nur wenn der Admin die Checkbox
// "Zugriff auf Finanzen" für diese Team-Zuweisung gesetzt hat.
function membershipAllowsModule(module: Module, membership: TeamMembership): boolean {
  if (module === 'finanzen') return membership.role === 'finance' || membership.financeAccess;
  return MODULE_ROLES[module].includes(membership.role);
}

/** Team-IDs, für die der Nutzer im gegebenen Modul Zugriff hat (leer für Admin = alle). */
export function accessibleTeamIds(
  module: Module,
  isAdmin: boolean,
  memberships: TeamMembership[],
): { allTeams: boolean; teamIds: string[] } {
  if (isAdmin) return { allTeams: true, teamIds: [] };
  const teamIds = memberships
    .filter((m) => membershipAllowsModule(module, m))
    .map((m) => m.teamId);
  return { allTeams: false, teamIds: Array.from(new Set(teamIds)) };
}

export function hasAnyModuleAccess(
  module: Module,
  isAdmin: boolean,
  memberships: TeamMembership[],
): boolean {
  if (isAdmin) return true;
  return memberships.some((m) => membershipAllowsModule(module, m));
}
