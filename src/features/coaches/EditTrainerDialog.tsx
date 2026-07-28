import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { TeamMultiPicker } from '../../components/TeamMultiPicker';
import { updateTrainer, replaceTrainerTeams } from './api';
import type { TrainerRow } from './api';
import type { TeamOption } from '../../lib/teams';

interface EditTrainerDialogProps {
  trainer: TrainerRow;
  teamOptions: TeamOption[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditTrainerDialog({ trainer, teamOptions, onClose, onSaved }: EditTrainerDialogProps) {
  const [firstName, setFirstName] = useState(trainer.first_name);
  const [lastName, setLastName] = useState(trainer.last_name);
  const [birthdate, setBirthdate] = useState(trainer.birthdate ?? '');
  const [teamIds, setTeamIds] = useState<string[]>(trainer.teams.map((t) => t.teamId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateTrainer(trainer.id, {
        first_name: firstName,
        last_name: lastName,
        birthdate: birthdate || null,
      });
      await replaceTrainerTeams(trainer.id, teamIds);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Änderungen konnten nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={`${trainer.first_name} ${trainer.last_name} bearbeiten`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="edit-trainer-form" disabled={loading}>
            {loading ? 'Speichern…' : 'Speichern'}
          </Button>
        </>
      }
    >
      <form id="edit-trainer-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
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
