import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { Select } from '../../components/Select';
import { CoachAssignmentPicker } from './CoachAssignmentPicker';
import { createTeam } from './api';
import type { AssignableUser, CoachAssignmentInput } from './api';
import type { Category } from '../../types/database';

function defaultSeason() {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

interface CreateTeamDialogProps {
  categories: Category[];
  users: AssignableUser[];
  defaultCategoryId?: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTeamDialog({ categories, users, defaultCategoryId, onClose, onCreated }: CreateTeamDialogProps) {
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? categories[0]?.id ?? '');
  const [name, setName] = useState('');
  const [season, setSeason] = useState(defaultSeason());
  const [duration, setDuration] = useState(90);
  const [coachAssignments, setCoachAssignments] = useState<CoachAssignmentInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createTeam({
        category_id: categoryId,
        name,
        season,
        default_training_duration_minutes: duration,
        coachAssignments,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Team konnte nicht angelegt werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Neues Team anlegen"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="create-team-form" disabled={loading}>
            {loading ? 'Anlegen…' : 'Team anlegen'}
          </Button>
        </>
      }
    >
      <form id="create-team-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="category">Alterskategorie</Label>
          <Select id="category" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="teamName">Teamname</Label>
            <Input id="teamName" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="season">Saison</Label>
            <Input id="season" required value={season} onChange={(e) => setSeason(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="duration">Standard-Trainingsdauer (Minuten)</Label>
          <Input
            id="duration"
            type="number"
            min={1}
            required
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </div>

        <div>
          <Label>Trainer-Zuweisung</Label>
          <CoachAssignmentPicker users={users} value={coachAssignments} onChange={setCoachAssignments} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
