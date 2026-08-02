import type { CoachRole } from '../types/database';

export type Module = 'finanzen' | 'training' | 'spiele' | 'spieler' | 'uebungen' | 'trainer' | 'checklisten';

// Rechtematrix aus dem Konzept: Finanzen für Admin, Headcoach und die
// dedizierte Finanzen-Rolle; alles andere auch für Assistenzcoach (jeweils
// nur im eigenen Team-Scope). Die Finanzen-Rolle hat ausschliesslich Zugriff
// auf das Finanzen-Modul.
const MODULE_ROLES: Record<Module, CoachRole[]> = {
  finanzen: ['headcoach', 'finance'],
  training: ['headcoach', 'assistant_coach'],
  spiele: ['headcoach', 'assistant_coach'],
  spieler: ['headcoach', 'assistant_coach'],
  uebungen: ['headcoach', 'assistant_coach'],
  trainer: ['headcoach', 'assistant_coach'],
  checklisten: ['headcoach', 'assistant_coach'],
};

export const ROLE_LABELS: Record<CoachRole, string> = {
  headcoach: 'Headcoach',
  assistant_coach: 'Assistenzcoach',
  finance: 'Finanzen',
};

export function moduleAllowsRole(module: Module, role: CoachRole): boolean {
  return MODULE_ROLES[module].includes(role);
}

export interface TeamMembership {
  teamId: string;
  role: CoachRole;
}

/** Team-IDs, für die der Nutzer im gegebenen Modul Zugriff hat (leer für Admin = alle). */
export function accessibleTeamIds(
  module: Module,
  isAdmin: boolean,
  memberships: TeamMembership[],
): { allTeams: boolean; teamIds: string[] } {
  if (isAdmin) return { allTeams: true, teamIds: [] };
  const teamIds = memberships
    .filter((m) => moduleAllowsRole(module, m.role))
    .map((m) => m.teamId);
  return { allTeams: false, teamIds: Array.from(new Set(teamIds)) };
}

export function hasAnyModuleAccess(
  module: Module,
  isAdmin: boolean,
  memberships: TeamMembership[],
): boolean {
  if (isAdmin) return true;
  return memberships.some((m) => moduleAllowsRole(module, m.role));
}
