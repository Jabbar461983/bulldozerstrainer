import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { TeamMultiPicker } from '../../components/TeamMultiPicker';
import { PlayerNotes } from './PlayerNotes';
import { PlayerGoals } from './PlayerGoals';
import { updatePlayer, replacePlayerTeams } from './api';
import type { PlayerRow } from './api';
import type { TeamOption } from '../../lib/teams';
import { useAuth } from '../../auth/AuthContext';

interface EditPlayerDialogProps {
  player: PlayerRow;
  teamOptions: TeamOption[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditPlayerDialog({ player, teamOptions, onClose, onSaved }: EditPlayerDialogProps) {
  const { profile } = useAuth();
  const [firstName, setFirstName] = useState(player.first_name);
  const [lastName, setLastName] = useState(player.last_name);
  const [birthdate, setBirthdate] = useState(player.birthdate ?? '');
  const [teamIds, setTeamIds] = useState<string[]>(player.teams.map((t) => t.teamId));
  const [defaultSeason, setDefaultSeason] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get default season from first team
  if (!defaultSeason && player.teams.length > 0) {
    // This will be set on first render
    setDefaultSeason(player.teams[0].season);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updatePlayer(player.id, {
        first_name: firstName,
        last_name: lastName,
        birthdate: birthdate || null,
      });
      await replacePlayerTeams(player.id, teamIds);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Änderungen konnten nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={`${player.first_name} ${player.last_name} bearbeiten`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="edit-player-form" disabled={loading}>
            {loading ? 'Speichern…' : 'Speichern'}
          </Button>
        </>
      }
    >
      <form id="edit-player-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
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

        <div>
          <Label>Ziele</Label>
          <PlayerGoals playerId={player.id} currentUserId={profile?.id ?? null} defaultSeason={defaultSeason} />
        </div>

        <div>
          <Label>Notizen</Label>
          <PlayerNotes playerId={player.id} currentUserId={profile?.id ?? null} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
