import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, UserTeamRole } from '../types/database';
import type { TeamMembership } from './permissions';
import { hasAnyModuleAccess, type Module } from './permissions';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  memberships: TeamMembership[];
  loading: boolean;
  isAdmin: boolean;
  canAccess: (module: Module) => boolean;
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
        .select('team_id, role, finance_access')
        .eq('user_id', userId) as unknown as Promise<{
        data: Pick<UserTeamRole, 'team_id' | 'role' | 'finance_access'>[] | null;
      }>,
    ]);
    setProfile(profileData ?? null);
    setMemberships(
      (roleData ?? []).map((r) => ({ teamId: r.team_id, role: r.role, financeAccess: r.finance_access })),
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
      canAccess: (module) => hasAnyModuleAccess(module, profile?.is_admin ?? false, memberships),
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
