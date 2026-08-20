import { adminClient, corsHeaders, json, requireAdmin } from '../_shared/admin.ts';

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
