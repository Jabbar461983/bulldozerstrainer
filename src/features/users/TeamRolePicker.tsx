import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import type { CoachRole } from '../../types/database';
import type { TeamOption, TeamRoleInput } from './api';

interface TeamRolePickerProps {
  teamOptions: TeamOption[];
  value: TeamRoleInput[];
  onChange: (value: TeamRoleInput[]) => void;
}

const ROLE_LABELS: Record<CoachRole, string> = {
  headcoach: 'Headcoach',
  assistant_coach: 'Assistenzcoach',
};

export function TeamRolePicker({ teamOptions, value, onChange }: TeamRolePickerProps) {
  function update(index: number, patch: Partial<TeamRoleInput>) {
    const next = value.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function add() {
    if (teamOptions.length === 0) return;
    onChange([...value, { team_id: teamOptions[0].teamId, role: 'assistant_coach' }]);
  }

  if (teamOptions.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Es sind noch keine Teams angelegt. Team-Zuweisungen können nachträglich unter „Teams“ ergänzt
        werden.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((row, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-xl border border-border p-2 sm:flex-row sm:items-center sm:border-0 sm:p-0"
        >
          <Select
            value={row.team_id}
            onChange={(e) => update(index, { team_id: e.target.value })}
            className="w-full min-w-0 sm:flex-1"
          >
            {teamOptions.map((t) => (
              <option key={t.teamId} value={t.teamId}>
                {t.categoryName} · {t.teamName} ({t.season})
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Select
              value={row.role}
              onChange={(e) => update(index, { role: e.target.value as CoachRole })}
              className="flex-1 min-w-0 sm:w-44 sm:flex-none"
            >
              <option value="headcoach">{ROLE_LABELS.headcoach}</option>
              <option value="assistant_coach">{ROLE_LABELS.assistant_coach}</option>
            </Select>
            <Button
              type="button"
              variant="ghost"
              onClick={() => remove(index)}
              aria-label="Zeile entfernen"
            >
              ✕
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={add} className="self-start">
        + Team-Zuweisung hinzufügen
      </Button>
    </div>
  );
}
