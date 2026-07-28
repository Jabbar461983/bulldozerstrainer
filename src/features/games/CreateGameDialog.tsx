import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { createGame } from './api';

interface CreateGameDialogProps {
  teamId: string;
  categoryId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateGameDialog({ teamId, categoryId, onClose, onCreated }: CreateGameDialogProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [season, setSeason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createGame({
        our_team_id: teamId,
        category_id: categoryId,
        date,
        time: time || null,
        location: location || null,
        home_team: homeTeam,
        away_team: awayTeam,
        season: season || null,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spiel konnte nicht angelegt werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Neues Spiel anlegen"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="create-game-form" disabled={loading}>
            {loading ? 'Anlegen…' : 'Spiel anlegen'}
          </Button>
        </>
      }
    >
      <form id="create-game-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="date">Datum</Label>
            <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="time">Zeit (optional)</Label>
            <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="homeTeam">Heimteam</Label>
            <Input id="homeTeam" required value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="awayTeam">Gastteam</Label>
            <Input id="awayTeam" required value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="location">Ort (optional)</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="season">Saison (optional)</Label>
          <Input id="season" value={season} onChange={(e) => setSeason(e.target.value)} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
