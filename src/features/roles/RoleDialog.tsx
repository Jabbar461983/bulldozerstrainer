import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import {
  CLUB_MODULES,
  MODULE_LABELS,
  PROTECTED_ROLE_KEYS,
  TEAM_MODULES,
  VORSTAND_ROLE_KEY,
} from '../../auth/permissions';
import type { Module } from '../../auth/permissions';
import { createRole, deleteRole, updateRole } from './api';
import type { RoleRow } from './api';
import { RessortsEditor } from './RessortsEditor';

interface RoleDialogProps {
  /** null = neue Rolle anlegen. */
  role: RoleRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function RoleDialog({ role, onClose, onSaved }: RoleDialogProps) {
  const [name, setName] = useState(role?.name ?? '');
  const [modules, setModules] = useState<string[]>(role?.modules ?? []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProtected = role?.system_key ? PROTECTED_ROLE_KEYS.includes(role.system_key) : false;
  const isVorstand = role?.system_key === VORSTAND_ROLE_KEY;

  function toggle(module: Module, checked: boolean) {
    setModules((prev) => (checked ? [...prev, module] : prev.filter((m) => m !== module)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = { name: name.trim(), modules };
      if (role) await updateRole(role.id, payload);
      else await createRole(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rolle konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!role) return;
    if (!window.confirm(`Willst du die Rolle „${role.name}“ wirklich löschen?`)) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteRole(role.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rolle konnte nicht gelöscht werden.');
    } finally {
      setDeleting(false);
    }
  }

  function renderGroup(title: string, hint: string, items: readonly Module[], dotClass: string) {
    return (
      <div className="flex min-w-0 flex-col gap-1 rounded-md border border-border p-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text">
          <span className={`size-2 rounded-[1px] ${dotClass}`} />
          {title}
        </p>
        <p className="mb-1 text-xs text-text-muted">{hint}</p>
        {items.map((m) => (
          <label key={m} className="flex cursor-pointer items-start gap-2.5 rounded px-1 py-1.5 text-sm text-text hover:bg-surface-alt">
            <input
              type="checkbox"
              className="mt-0.5 size-[18px] shrink-0 accent-[var(--club-accent)]"
              checked={modules.includes(m)}
              onChange={(e) => toggle(m, e.target.checked)}
            />
            {MODULE_LABELS[m]}
          </label>
        ))}
      </div>
    );
  }

  return (
    <Modal
      title={role ? `Rolle bearbeiten · ${role.name}` : 'Neue Rolle'}
      onClose={onClose}
      wide
      footer={
        <>
          {role && !isProtected && (
            <Button type="button" variant="danger" disabled={deleting} onClick={() => void handleDelete()}>
              Löschen
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="role-form" disabled={saving || !name.trim()}>
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </>
      }
    >
      <form id="role-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="role-name">Name der Rolle</Label>
          <Input id="role-name" required value={name} onChange={(e) => setName(e.target.value)} />
          {isProtected && (
            <p className="mt-1.5 text-xs text-text-muted">
              Fest eingebaute Rolle: kann umbenannt, aber nicht gelöscht werden.
              {isVorstand && ' Sie wird immer für alle Teams vergeben.'}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {renderGroup(
            'Im zugewiesenen Team',
            'Gilt nur für die Teams, in denen die Person diese Rolle hat.',
            TEAM_MODULES,
            'bg-accent',
          )}
          {renderGroup(
            'Vereinsweit',
            'Gilt unabhängig vom Team, sobald die Person diese Rolle irgendwo hat.',
            CLUB_MODULES,
            'bg-gold',
          )}
        </div>
        {isVorstand && <RessortsEditor />}
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-md bg-surface-alt px-3 py-2.5 text-text-muted">
            <p className="text-xs font-bold uppercase tracking-wider text-text">Immer für alle</p>
            Start, Aufgaben (eigene Aufgaben erstellen und erledigen)
          </div>
          <div className="rounded-md bg-surface-alt px-3 py-2.5 text-text-muted">
            <p className="text-xs font-bold uppercase tracking-wider text-text">Nur Admin</p>
            Benutzer, Rollen, Budget bearbeiten und alle Sonderrechte wie Löschen von Notizen, Zielen,
            Kommentaren und Übungen, Spiele importieren, Checklisten-Instanzen löschen
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
