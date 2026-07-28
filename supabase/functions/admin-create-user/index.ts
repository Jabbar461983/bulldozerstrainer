import { adminClient, json, requireAdmin } from '../_shared/admin.ts';

interface CreateUserBody {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  is_admin?: boolean;
  team_roles?: { team_id: string; role: 'headcoach' | 'assistant_coach' }[];
}

Deno.serve(async (req) => {
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

  const admin = adminClient();

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(body.email, {
    data: {
      first_name: body.first_name,
      last_name: body.last_name,
      phone: body.phone ?? null,
      is_admin: body.is_admin ?? false,
    },
  });

  if (inviteError || !invited.user) {
    return json({ error: inviteError?.message ?? 'Benutzer konnte nicht angelegt werden.' }, 400);
  }

  if (body.team_roles?.length) {
    const rows = body.team_roles.map((tr) => ({
      user_id: invited.user!.id,
      team_id: tr.team_id,
      role: tr.role,
    }));
    const { error: rolesError } = await admin.from('user_team_roles').insert(rows);
    if (rolesError) {
      return json(
        {
          warning: `Benutzer wurde angelegt, Team-/Rollenzuweisung ist aber fehlgeschlagen: ${rolesError.message}`,
          user: { id: invited.user.id, email: invited.user.email },
        },
        200,
      );
    }
  }

  return json({ user: { id: invited.user.id, email: invited.user.email } }, 200);
});
