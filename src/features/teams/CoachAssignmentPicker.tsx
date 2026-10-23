import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import type { Role } from '../../types/database';
import type { AssignableUser, CoachAssignmentInput } from './api';

interface CoachAssignmentPickerProps {
  users: AssignableUser[];
  /** Rollen, die einem Team zugewiesen werden können (ohne Vorstand). */
  roles: Role[];
  value: CoachAssignmentInput[];
  onChange: (value: CoachAssignmentInput[]) => void;
}

export function CoachAssignmentPicker({ users, roles, value, onChange }: CoachAssignmentPickerProps) {
  const assistantRoleId = roles.find((r) => r.system_key === 'assistant_coach')?.id;

  function update(index: number, patch: Partial<CoachAssignmentInput>) {
    const next = value.map((row, i) => {
      if (i !== index) return row;
      const merged = { ...row, ...patch };
      // Häkchen Finanzzugriff gibt es nur beim Assistenzcoach.
      if (merged.role_id !== assistantRoleId) merged.finance_access = false;
      return merged;
    });
    onChange(next);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function add() {
    if (users.length === 0 || roles.length === 0) return;
    const defaultRole = roles.find((r) => r.system_key === 'assistant_coach') ?? roles[0];
    onChange([...value, { user_id: users[0].id, role_id: defaultRole.id, finance_access: false }]);
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
    <div className="flex flex-col gap-1">
      {value.map((row, index) => (
        <div key={index} className="flex flex-col gap-1 sm:gap-0 sm:flex-row sm:items-center sm:gap-2">
          <Select
            value={row.user_id}
            onChange={(e) => update(index, { user_id: e.target.value })}
            className="flex-1 min-w-0"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </Select>
          <Select
            value={row.role_id}
            onChange={(e) => update(index, { role_id: e.target.value })}
            className="min-w-0 sm:w-44"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          {row.role_id === assistantRoleId && (
            <label className="flex items-center gap-2 whitespace-nowrap text-sm text-text">
              <input
                type="checkbox"
                className="size-5"
                checked={row.finance_access}
                onChange={(e) => update(index, { finance_access: e.target.checked })}
              />
              Finanzzugriff
            </label>
          )}
          <Button type="button" variant="ghost" onClick={() => remove(index)} aria-label="Zeile entfernen" className="self-start sm:self-center">
            ✕
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={add} className="self-start text-sm">
        + Trainer-Zuweisung hinzufügen
      </Button>
    </div>
  );
}
