import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { TeamMultiPicker } from '../../components/TeamMultiPicker';
import { createTrainer } from './api';
import type { TeamOption } from '../../lib/teams';

interface CreateTrainerDialogProps {
  teamOptions: TeamOption[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTrainerDialog({ teamOptions, onClose, onCreated }: CreateTrainerDialogProps) {
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
      await createTrainer({
        first_name: firstName,
        last_name: lastName,
        birthdate: birthdate || null,
        team_ids: teamIds,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trainer konnte nicht angelegt werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Neuen Trainer anlegen"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="create-trainer-form" disabled={loading}>
            {loading ? 'Anlegen…' : 'Trainer anlegen'}
          </Button>
        </>
      }
    >
      <form id="create-trainer-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
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
