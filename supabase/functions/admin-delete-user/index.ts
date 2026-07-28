import { adminClient, json, requireAdmin } from '../_shared/admin.ts';

interface DeleteUserBody {
  user_id: string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAdmin(req);
  if ('error' in auth) return auth.error;

  let body: DeleteUserBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ungültiger Request-Body.' }, 400);
  }

  if (!body.user_id) {
    return json({ error: 'user_id fehlt.' }, 400);
  }
  if (body.user_id === auth.userId) {
    return json({ error: 'Du kannst dein eigenes Konto nicht löschen.' }, 400);
  }

  const admin = adminClient();
  const { error } = await admin.auth.admin.deleteUser(body.user_id);
  if (error) {
    return json({ error: error.message }, 400);
  }

  return json({ ok: true }, 200);
});
