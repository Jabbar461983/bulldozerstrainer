import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, Role } from '../types/database';
import type { TeamMembership } from './permissions';
import { hasAnyModuleAccess, VORSTAND_ROLE_KEY, type Module } from './permissions';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  memberships: TeamMembership[];
  loading: boolean;
  isAdmin: boolean;
  /** Hat die fest eingebaute Rolle "Vorstand". */
  isVorstand: boolean;
  /** true, wenn der Nutzer (eines der) Module sieht. */
  canAccess: (module: Module | Module[]) => boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const [{ data: profileData }, { data: roleData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase
        .from('user_team_roles')
        .select('team_id, role_id, roles(name, system_key, modules)')
        .eq('user_id', userId) as unknown as Promise<{
        data:
          | {
              team_id: string | null;
              role_id: string;
              roles: Pick<Role, 'name' | 'system_key' | 'modules'> | null;
            }[]
          | null;
      }>,
    ]);
    setProfile(profileData ?? null);
    setMemberships(
      (roleData ?? []).map((r) => ({
        teamId: r.team_id,
        roleId: r.role_id,
        roleName: r.roles?.name ?? '',
        systemKey: r.roles?.system_key ?? null,
        modules: r.roles?.modules ?? [],
      })),
    );
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        setMemberships([]);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      memberships,
      loading,
      isAdmin: profile?.is_admin ?? false,
      isVorstand: memberships.some((m) => m.systemKey === VORSTAND_ROLE_KEY),
      canAccess: (module) =>
        (Array.isArray(module) ? module : [module]).some((m) =>
          hasAnyModuleAccess(m, profile?.is_admin ?? false, memberships),
        ),
      refreshProfile: async () => {
        if (session) await loadProfile(session.user.id);
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, profile, memberships, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
