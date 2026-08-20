import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function requireAdmin(req: Request) {
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

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

interface SetPasswordBody {
  user_id: string;
  password: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAdmin(req);
  if ('error' in auth) return auth.error;

  let body: SetPasswordBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ungültiger Request-Body.' }, 400);
  }

  if (!body.user_id || !body.password) {
    return json({ error: 'Benutzer-ID und Passwort sind Pflichtfelder.' }, 400);
  }
  if (body.password.length < 8) {
    return json({ error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' }, 400);
  }

  const admin = adminClient();
  const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
  if (error) {
    return json({ error: error.message }, 400);
  }

  return json({ ok: true }, 200);
});
