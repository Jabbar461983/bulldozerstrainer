import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { VORSTAND_ROLE_KEY } from '../../auth/permissions';
import type { Role } from '../../types/database';
import type { TeamOption, TeamRoleInput } from './api';

// Sentinel für den <select>-Wert "Alle Teams" (team_id null).
const ALL_TEAMS = '__all__';

interface TeamRolePickerProps {
  teamOptions: TeamOption[];
  roles: Role[];
  value: TeamRoleInput[];
  onChange: (value: TeamRoleInput[]) => void;
}

export function TeamRolePicker({ teamOptions, roles, value, onChange }: TeamRolePickerProps) {
  const vorstandRoleId = roles.find((r) => r.system_key === VORSTAND_ROLE_KEY)?.id;

  function update(index: number, patch: Partial<TeamRoleInput>) {
    const next = value.map((row, i) => {
      if (i !== index) return row;
      const merged = { ...row, ...patch };
      // Vorstand gilt immer für alle Teams.
      if (merged.role_id === vorstandRoleId) merged.team_id = null;
      return merged;
    });
    onChange(next);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function add() {
    if (roles.length === 0) return;
    const defaultRole = roles.find((r) => r.system_key === 'assistant_coach') ?? roles[0];
    onChange([...value, { team_id: teamOptions[0]?.teamId ?? null, role_id: defaultRole.id }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((row, index) => {
        const isVorstand = row.role_id === vorstandRoleId;
        return (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border border-border p-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:border-0 sm:p-0"
          >
            <Select
              aria-label="Bereich"
              value={row.team_id ?? ALL_TEAMS}
              disabled={isVorstand}
              onChange={(e) => update(index, { team_id: e.target.value === ALL_TEAMS ? null : e.target.value })}
              className="col-span-2 sm:col-span-1"
            >
              <option value={ALL_TEAMS}>Alle Teams</option>
              {teamOptions.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.categoryName} · {t.teamName} ({t.season})
                </option>
              ))}
            </Select>
            <Select aria-label="Rolle" value={row.role_id} onChange={(e) => update(index, { role_id: e.target.value })}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Button type="button" variant="ghost" onClick={() => remove(index)} aria-label="Zeile entfernen">
              ✕
            </Button>
          </div>
        );
      })}
      <Button type="button" variant="secondary" size="sm" onClick={add} className="self-start" disabled={roles.length === 0}>
        + Zuweisung hinzufügen
      </Button>
    </div>
  );
}
