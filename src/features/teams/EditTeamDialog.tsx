import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { Select } from '../../components/Select';
import { CoachAssignmentPicker } from './CoachAssignmentPicker';
import { updateTeam, replaceCoachAssignments } from './api';
import type { AssignableUser, CoachAssignmentInput, TeamRow } from './api';
import type { Category } from '../../types/database';

interface EditTeamDialogProps {
  team: TeamRow;
  categories: Category[];
  users: AssignableUser[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditTeamDialog({ team, categories, users, onClose, onSaved }: EditTeamDialogProps) {
  const [categoryId, setCategoryId] = useState(team.category_id);
  const [name, setName] = useState(team.name);
  const [season, setSeason] = useState(team.season);
  const [duration, setDuration] = useState(team.default_training_duration_minutes);
  const [coachAssignments, setCoachAssignments] = useState<CoachAssignmentInput[]>(
    team.coachAssignments.map((a) => ({ user_id: a.userId, role: a.role, finance_access: a.financeAccess })),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateTeam(team.id, {
        category_id: categoryId,
        name,
        season,
        default_training_duration_minutes: duration,
      });
      await replaceCoachAssignments(team.id, coachAssignments);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Änderungen konnten nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={`Team „${team.name}“ bearbeiten`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="edit-team-form" disabled={loading}>
            {loading ? 'Speichern…' : 'Speichern'}
          </Button>
        </>
      }
    >
      <form id="edit-team-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
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
