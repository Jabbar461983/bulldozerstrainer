import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { TeamMultiPicker } from '../../components/TeamMultiPicker';
import { createPlayer } from './api';
import type { TeamOption } from '../../lib/teams';

interface CreatePlayerDialogProps {
  teamOptions: TeamOption[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreatePlayerDialog({ teamOptions, onClose, onCreated }: CreatePlayerDialogProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createPlayer({
        first_name: firstName,
        last_name: lastName,
        birthdate: birthdate || null,
        team_ids: teamIds,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spieler konnte nicht angelegt werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Neuen Spieler anlegen"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="create-player-form" disabled={loading}>
            {loading ? 'Anlegen…' : 'Spieler anlegen'}
          </Button>
        </>
      }
    >
      <form id="create-player-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <Label htmlFor="birthdate">Geburtsdatum (optional)</Label>
          <Input id="birthdate" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
        </div>

        <div>
          <Label>Team-Zuweisung</Label>
          <TeamMultiPicker teamOptions={teamOptions} value={teamIds} onChange={setTeamIds} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
