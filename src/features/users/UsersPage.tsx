import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { List, ListRow } from '../../components/List';
import { useAuth } from '../../auth/AuthContext';
import { fetchUsers, fetchTeamOptions, fetchRoles, fetchRessorts, deleteUser } from './api';
import type { Role, VorstandRessort } from '../../types/database';
import type { UserRow, TeamOption } from './api';
import { VORSTAND_ROLE_KEY } from '../../auth/permissions';
import { CreateUserDialog } from './CreateUserDialog';
import { EditUserDialog } from './EditUserDialog';
import { SetPasswordDialog } from './SetPasswordDialog';

/** Bereich einer Zuweisung: Team, "Alle Teams" oder (beim Vorstand) das Ressort. */
function roleAreaLabel(tr: UserRow['teamRoles'][number]): string {
  if (tr.roleSystemKey === VORSTAND_ROLE_KEY) return tr.ressortName ?? 'Ohne Ressort';
  return tr.teamId ? `${tr.categoryName} · ${tr.teamName}` : 'Alle Teams';
}

export function UsersPage() {
  const { profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [ressorts, setRessorts] = useState<VorstandRessort[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);
  const [search, setSearch] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [userRows, teams, roleRows, ressortRows] = await Promise.all([
        fetchUsers(),
        fetchTeamOptions(),
        fetchRoles(),
        fetchRessorts(),
      ]);
      setRessorts(ressortRows);
      setUsers(userRows);
      setTeamOptions(teams);
      setRoles(roleRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benutzer konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleDelete(user: UserRow) {
    if (user.id === currentProfile?.id) return;
    const confirmed = window.confirm(
      `${user.first_name} ${user.last_name} (${user.email}) wirklich unwiderruflich löschen?`,
    );
    if (!confirmed) return;
    setBusyUserId(user.id);
    setError(null);
    try {
      await deleteUser(user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benutzer konnte nicht gelöscht werden.');
    } finally {
      setBusyUserId(null);
    }
  }

  // Suche: Treffer im Vor- oder Nachnamen (Gross-/Kleinschreibung egal).
  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!users || !term) return users;
    return users.filter(
      (u) =>
        u.first_name.toLowerCase().includes(term) ||
        u.last_name.toLowerCase().includes(term) ||
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(term),
    );
  }, [users, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-text">Benutzerverwaltung</h1>
        <Button onClick={() => setShowCreate(true)}>+ Neuer Benutzer</Button>
      </div>

      {error && (
        <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>
      )}

      {users !== null && users.length > 0 && (
        <div className="relative max-w-sm">
          <Input
            type="search"
            aria-label="Benutzer suchen"
            placeholder="Benutzer suchen (Vor- oder Nachname)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        </div>
      )}

      {users === null && <p className="text-sm text-text-muted">Lädt…</p>}
      {users?.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Noch keine Benutzer angelegt.</p>
        </Card>
      )}
      {users !== null && users.length > 0 && visibleUsers?.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Kein Benutzer gefunden für „{search.trim()}“.</p>
        </Card>
      )}

      <List>
        {visibleUsers?.map((user) => (
          <ListRow key={user.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-text">
                  {user.first_name} {user.last_name}
                  {user.id === currentProfile?.id && (
                    <span className="ml-2 text-xs text-text-muted">(du)</span>
                  )}
                </p>
                <p className="text-sm text-text-muted">{user.email}</p>
                {user.phone && <p className="text-sm text-text-muted">{user.phone}</p>}
              </div>
              {user.is_admin && (
                <span className="rounded bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                  Admin
                </span>
              )}
            </div>

            {!user.is_admin && (
              <div className="flex flex-wrap gap-1.5">
                {user.teamRoles.length === 0 && (
                  <span className="text-xs text-text-muted">Keine Rolle zugewiesen</span>
                )}
                {user.teamRoles.map((tr) => (
                  <span
                    key={`${tr.teamId ?? 'alle'}-${tr.roleId}-${tr.ressortId ?? ''}`}
                    className="rounded bg-surface-alt px-2.5 py-1 text-xs text-text-muted"
                  >
                    {roleAreaLabel(tr)} – {tr.roleName}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditingUser(user)}>
                Bearbeiten
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPasswordUser(user)}>
                Neues Passwort setzen
              </Button>
              {user.id !== currentProfile?.id && (
                <Button size="sm"
                  variant="danger"
                  disabled={busyUserId === user.id}
                  onClick={() => void handleDelete(user)}
                >
                  Löschen
                </Button>
              )}
            </div>
          </ListRow>
        ))}
      </List>

      {showCreate && (
        <CreateUserDialog
          teamOptions={teamOptions}
          roles={roles}
          ressorts={ressorts}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          teamOptions={teamOptions}
          roles={roles}
          ressorts={ressorts}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            void load();
          }}
        />
      )}

      {passwordUser && <SetPasswordDialog user={passwordUser} onClose={() => setPasswordUser(null)} />}
    </div>
  );
}
