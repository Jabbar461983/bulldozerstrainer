import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { List, ListRow } from '../../components/List';
import { isClubModule, MODULE_SHORT_LABELS, PROTECTED_ROLE_KEYS } from '../../auth/permissions';
import type { Module } from '../../auth/permissions';
import { fetchRolesWithCounts } from './api';
import type { RoleRow } from './api';
import { RoleDialog } from './RoleDialog';

export function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoleRow | 'new' | null>(null);

  async function load() {
    setError(null);
    try {
      setRoles(await fetchRolesWithCounts());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollen konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-text">Rollen</h1>
        <Button onClick={() => setEditing('new')}>+ Neue Rolle</Button>
      </div>
      <p className="text-sm text-text-muted">
        Jede Rolle schaltet Module frei. Grün gilt im zugewiesenen Team, Gold gilt vereinsweit. Zugewiesen werden
        die Rollen unter „Benutzer“.
      </p>

      {error && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {roles === null && !error && <p className="text-sm text-text-muted">Lädt…</p>}
      {roles?.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Noch keine Rollen angelegt.</p>
        </Card>
      )}

      <List>
        {roles?.map((role) => (
          <ListRow key={role.id} onClick={() => setEditing(role)} className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-40 flex-1">
              <p className="font-semibold text-text">
                {role.name}
                {role.system_key && PROTECTED_ROLE_KEYS.includes(role.system_key) && (
                  <span className="ml-2 rounded bg-surface-alt px-1.5 py-0.5 text-[11px] font-semibold text-text-muted">
                    fest eingebaut
                  </span>
                )}
              </p>
              <p className="text-xs text-text-muted">
                {role.assignmentCount} {role.assignmentCount === 1 ? 'Zuweisung' : 'Zuweisungen'}
              </p>
            </div>
            <div className="flex min-w-0 flex-[2] flex-wrap gap-1.5">
              {role.modules.length === 0 && <span className="text-xs text-text-muted">Keine Module</span>}
              {role.modules.filter((m) => m in MODULE_SHORT_LABELS).map((m) => (
                <span
                  key={m}
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    isClubModule(m) ? 'bg-gold/15 text-gold-text' : 'bg-accent/10 text-accent'
                  }`}
                >
                  {MODULE_SHORT_LABELS[m as Module]}
                </span>
              ))}
            </div>
          </ListRow>
        ))}
      </List>

      {editing && (
        <RoleDialog
          role={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
