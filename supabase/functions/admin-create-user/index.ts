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

interface CreateUserBody {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  is_admin?: boolean;
  team_roles?: { team_id: string; role: 'headcoach' | 'assistant_coach' | 'finance'; finance_access?: boolean }[];
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

  let body: CreateUserBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ungültiger Request-Body.' }, 400);
  }

  if (!body.email || !body.first_name || !body.last_name) {
    return json({ error: 'E-Mail, Vorname und Nachname sind Pflichtfelder.' }, 400);
  }
  if (!body.password || body.password.length < 8) {
    return json({ error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' }, 400);
  }

  const admin = adminClient();

  // Der Benutzer erhält Login-Daten direkt vom Admin (z.B. per WhatsApp),
  // daher wird das Konto direkt mit Passwort und bestätigter E-Mail angelegt
  // - keine Einladungs-/Bestätigungs-E-Mail nötig.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: body.email.trim(),
    password: body.password,
    email_confirm: true,
    user_metadata: {
      first_name: body.first_name,
      last_name: body.last_name,
      phone: body.phone ?? null,
      is_admin: body.is_admin ?? false,
    },
  });

  if (createError || !created.user) {
    return json({ error: createError?.message ?? 'Benutzer konnte nicht angelegt werden.' }, 400);
  }

  if (body.team_roles?.length) {
    const rows = body.team_roles.map((tr) => ({
      user_id: created.user!.id,
      team_id: tr.team_id,
      role: tr.role,
      finance_access: tr.finance_access ?? false,
    }));
    const { error: rolesError } = await admin.from('user_team_roles').insert(rows);
    if (rolesError) {
      return json(
        {
          warning: `Benutzer wurde angelegt, Team-/Rollenzuweisung ist aber fehlgeschlagen: ${rolesError.message}`,
          user: { id: created.user.id, email: created.user.email },
        },
        200,
      );
    }
  }

  return json({ user: { id: created.user.id, email: created.user.email } }, 200);
});
