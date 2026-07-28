import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { TeamRolePicker } from './TeamRolePicker';
import { createUser } from './api';
import type { TeamOption, TeamRoleInput } from './api';

interface CreateUserDialogProps {
  teamOptions: TeamOption[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreateUserDialog({ teamOptions, onClose, onCreated }: CreateUserDialogProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [teamRoles, setTeamRoles] = useState<TeamRoleInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createUser({
        email,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        is_admin: isAdmin,
        team_roles: teamRoles,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benutzer konnte nicht angelegt werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Neuen Benutzer anlegen"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="create-user-form" disabled={loading}>
            {loading ? 'Anlegen…' : 'Benutzer anlegen'}
          </Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <Label htmlFor="email">E-Mail-Adresse</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="mt-1 text-xs text-text-muted">
            Der Benutzer erhält eine Einladung per E-Mail und setzt dort sein eigenes Passwort.
          </p>
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
            onChange={(e) => setIsAdmin(e.target.checked)}
          />
          Admin (voller Zugriff auf alle Teams &amp; Module)
        </label>

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
