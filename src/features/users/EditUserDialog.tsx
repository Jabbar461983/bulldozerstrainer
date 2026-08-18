import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { TeamRolePicker } from './TeamRolePicker';
import { updateProfile, replaceTeamRoles } from './api';
import type { TeamOption, TeamRoleInput, UserRow } from './api';
import { useAuth } from '../../auth/AuthContext';

interface EditUserDialogProps {
  user: UserRow;
  teamOptions: TeamOption[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditUserDialog({ user, teamOptions, onClose, onSaved }: EditUserDialogProps) {
  const { profile: currentProfile } = useAuth();
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [isAdmin, setIsAdmin] = useState(user.is_admin);
  const [teamRoles, setTeamRoles] = useState<TeamRoleInput[]>(
    user.teamRoles.map((tr) => ({ team_id: tr.teamId, role: tr.role, finance_access: tr.financeAccess })),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = currentProfile?.id === user.id;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateProfile(user.id, {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        is_admin: isAdmin,
      });
      await replaceTeamRoles(user.id, isAdmin ? [] : teamRoles);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Änderungen konnten nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={`${user.first_name} ${user.last_name} bearbeiten`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="edit-user-form" disabled={loading}>
            {loading ? 'Speichern…' : 'Speichern'}
          </Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label>E-Mail-Adresse</Label>
          <Input value={user.email} disabled />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName">Vorname</Label>
            <Input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="lastName">Nachname</Label>
            <Input id="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="phone">Telefon (optional)</Label>
          <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            className="size-5"
            checked={isAdmin}
            disabled={isSelf}
            onChange={(e) => setIsAdmin(e.target.checked)}
          />
          Admin (voller Zugriff auf alle Teams &amp; Module)
        </label>
        {isSelf && (
          <p className="-mt-2 text-xs text-text-muted">
            Du kannst deinen eigenen Admin-Status nicht selbst entziehen.
          </p>
        )}

        {!isAdmin && (
          <div>
            <Label>Team- &amp; Rollenzuweisung</Label>
            <TeamRolePicker teamOptions={teamOptions} value={teamRoles} onChange={setTeamRoles} />
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
