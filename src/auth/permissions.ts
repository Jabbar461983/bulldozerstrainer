// Rechte über frei definierbare Rollen (Migration 0096).
//
// Eine Rolle schaltet Module frei. Zuweisung: Benutzer + Team + Rolle, wobei
// "Alle Teams" (teamId null) die Rolle vereinsweit vergibt.
//   - Team-Module gelten im zugewiesenen Team (bzw. in allen Teams).
//   - Vereinsweite Module gelten, sobald die Person die Rolle irgendwo hat.
// Der Admin sieht alles; Benutzer, Rollen und Sonderrechte bleiben beim Admin.
// Die Datenbank setzt dieselben Regeln per RLS durch (has_module /
// module_team_ids), das Frontend blendet nur entsprechend ein/aus.

export const TEAM_MODULES = ['training', 'saisonplanung', 'spiele', 'spieler', 'checklisten', 'finanzen'] as const;
export const CLUB_MODULES = [
  'uebungen',
  'teams',
  'checklisten_verwaltung',
  'finanzen_verein',
  'aufgaben_uebersicht',
] as const;

export type TeamModule = (typeof TEAM_MODULES)[number];
export type ClubModule = (typeof CLUB_MODULES)[number];
export type Module = TeamModule | ClubModule;

export const MODULE_LABELS: Record<Module, string> = {
  training: 'Training',
  saisonplanung: 'Saisonplanung',
  spiele: 'Spiele',
  spieler: 'Spieler',
  checklisten: 'Checklisten (abhaken)',
  finanzen: 'Finanzen (Belege erfassen und ansehen)',
  uebungen: 'Übungsdatenbank',
  teams: 'Teamverwaltung',
  checklisten_verwaltung: 'Checklisten-Vorlagen',
  finanzen_verein: 'Finanzen: Verein und Gesamtübersicht',
  aufgaben_uebersicht: 'Aufgaben: Gesamtübersicht und Statistik',
};

/** Kurze Bezeichnungen für Chips in Listen. */
export const MODULE_SHORT_LABELS: Record<Module, string> = {
  training: 'Training',
  saisonplanung: 'Saisonplanung',
  spiele: 'Spiele',
  spieler: 'Spieler',
  checklisten: 'Checklisten',
  finanzen: 'Finanzen',
  uebungen: 'Übungen',
  teams: 'Teamverwaltung',
  checklisten_verwaltung: 'Checklisten-Vorlagen',
  finanzen_verein: 'Finanzen Verein',
  aufgaben_uebersicht: 'Aufgaben-Übersichten',
};

export function isClubModule(module: string): module is ClubModule {
  return (CLUB_MODULES as readonly string[]).includes(module);
}

/** Fest eingebaute Rollen, die nicht gelöscht werden können. */
export const PROTECTED_ROLE_KEYS = ['headcoach', 'assistant_coach', 'vorstand'];
export const VORSTAND_ROLE_KEY = 'vorstand';

export interface TeamMembership {
  /** null = "Alle Teams". */
  teamId: string | null;
  roleId: string;
  roleName: string;
  systemKey: string | null;
  modules: string[];
}

/** Team-IDs, für die der Nutzer im gegebenen Modul Zugriff hat (allTeams für Admin bzw. "Alle Teams"). */
export function accessibleTeamIds(
  module: Module,
  isAdmin: boolean,
  memberships: TeamMembership[],
): { allTeams: boolean; teamIds: string[] } {
  if (isAdmin) return { allTeams: true, teamIds: [] };
  const relevant = memberships.filter((m) => m.modules.includes(module));
  if (relevant.some((m) => m.teamId === null)) return { allTeams: true, teamIds: [] };
  const teamIds = relevant.map((m) => m.teamId).filter((id): id is string => id !== null);
  return { allTeams: false, teamIds: Array.from(new Set(teamIds)) };
}

export function hasAnyModuleAccess(module: Module, isAdmin: boolean, memberships: TeamMembership[]): boolean {
  if (isAdmin) return true;
  return memberships.some((m) => m.modules.includes(module));
}

/** Filtert Team-Optionen auf die Teams, in denen das Modul sichtbar ist. */
export function filterTeamsForModule<T extends { teamId: string }>(
  options: T[],
  module: Module,
  isAdmin: boolean,
  memberships: TeamMembership[],
): T[] {
  const scope = accessibleTeamIds(module, isAdmin, memberships);
  return scope.allTeams ? options : options.filter((o) => scope.teamIds.includes(o.teamId));
}
