import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

export function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Prüft anhand des mitgesendeten JWT, ob der Aufrufer ein Admin ist. */
export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return { error: json({ error: 'Nicht authentifiziert.' }, 401) };
  }

  const { data: profile } = await callerClient
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single();

  if (!profile?.is_admin) {
    return { error: json({ error: 'Nur Admins dürfen diese Aktion ausführen.' }, 403) };
  }

  return { userId: userData.user.id };
}

export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}
