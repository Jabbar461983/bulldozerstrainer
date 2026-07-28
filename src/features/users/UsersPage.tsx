import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useAuth } from '../../auth/AuthContext';
import { fetchUsers, fetchTeamOptions, deleteUser, sendPasswordReset } from './api';
import type { UserRow, TeamOption } from './api';
import { CreateUserDialog } from './CreateUserDialog';
import { EditUserDialog } from './EditUserDialog';

export function UsersPage() {
  const { profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [userRows, teams] = await Promise.all([fetchUsers(), fetchTeamOptions()]);
      setUsers(userRows);
      setTeamOptions(teams);
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

  async function handlePasswordReset(user: UserRow) {
    setBusyUserId(user.id);
    setNotice(null);
    setError(null);
    try {
      await sendPasswordReset(user.email);
      setNotice(`Reset-Link an ${user.email} gesendet.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset-Link konnte nicht gesendet werden.');
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">Benutzerverwaltung</h1>
        <Button onClick={() => setShowCreate(true)}>+ Neuer Benutzer</Button>
      </div>

      {error && (
        <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>
      )}
      {notice && (
        <p className="rounded-xl bg-success/10 p-3 text-sm text-success">{notice}</p>
      )}

      {users === null && <p className="text-sm text-text-muted">Lädt…</p>}
      {users?.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Noch keine Benutzer angelegt.</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {users?.map((user) => (
          <Card key={user.id} className="flex flex-col gap-3">
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
                <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                  Admin
                </span>
              )}
            </div>

            {!user.is_admin && (
              <div className="flex flex-wrap gap-1.5">
                {user.teamRoles.length === 0 && (
                  <span className="text-xs text-text-muted">Keinem Team zugewiesen</span>
                )}
                {user.teamRoles.map((tr) => (
                  <span
                    key={tr.teamId}
                    className="rounded-full bg-surface-alt px-2.5 py-1 text-xs text-text-muted"
                  >
                    {tr.categoryName} · {tr.teamName} –{' '}
                    {tr.role === 'headcoach' ? 'Headcoach' : 'Assistenzcoach'}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setEditingUser(user)}>
                Bearbeiten
              </Button>
              <Button
                variant="secondary"
                disabled={busyUserId === user.id}
                onClick={() => void handlePasswordReset(user)}
              >
                Passwort-Reset senden
              </Button>
              {user.id !== currentProfile?.id && (
                <Button
                  variant="danger"
                  disabled={busyUserId === user.id}
                  onClick={() => void handleDelete(user)}
                >
                  Löschen
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {showCreate && (
        <CreateUserDialog
          teamOptions={teamOptions}
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
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
