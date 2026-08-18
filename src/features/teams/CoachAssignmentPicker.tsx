import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { ROLE_LABELS } from '../../auth/permissions';
import type { CoachRole } from '../../types/database';
import type { AssignableUser, CoachAssignmentInput } from './api';

interface CoachAssignmentPickerProps {
  users: AssignableUser[];
  value: CoachAssignmentInput[];
  onChange: (value: CoachAssignmentInput[]) => void;
}

export function CoachAssignmentPicker({ users, value, onChange }: CoachAssignmentPickerProps) {
  function update(index: number, patch: Partial<CoachAssignmentInput>) {
    const next = value.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function add() {
    if (users.length === 0) return;
    onChange([...value, { user_id: users[0].id, role: 'assistant_coach', finance_access: false }]);
  }

  if (users.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Es sind noch keine Trainer-Benutzer angelegt. Zuweisungen können nachträglich unter „Benutzer“
        ergänzt werden.
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
            value={row.user_id}
            onChange={(e) => update(index, { user_id: e.target.value })}
            className="w-full min-w-0 sm:flex-1"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
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
              <option value="finance">{ROLE_LABELS.finance}</option>
            </Select>
            <Button type="button" variant="ghost" onClick={() => remove(index)} aria-label="Zeile entfernen">
              ✕
            </Button>
          </div>
          {row.role !== 'finance' && (
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                className="size-5"
                checked={row.finance_access}
                onChange={(e) => update(index, { finance_access: e.target.checked })}
              />
              Zugriff auf Finanzen dieses Teams
            </label>
          )}
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={add} className="self-start">
        + Trainer-Zuweisung hinzufügen
      </Button>
    </div>
  );
}
