import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { VORSTAND_ROLE_KEY } from '../../auth/permissions';
import type { Role, VorstandRessort } from '../../types/database';
import type { TeamOption, TeamRoleInput } from './api';

// Sentinel für den <select>-Wert "Alle Teams" (team_id null).
const ALL_TEAMS = '__all__';

interface TeamRolePickerProps {
  teamOptions: TeamOption[];
  roles: Role[];
  ressorts: VorstandRessort[];
  value: TeamRoleInput[];
  onChange: (value: TeamRoleInput[]) => void;
}

export function TeamRolePicker({ teamOptions, roles, ressorts, value, onChange }: TeamRolePickerProps) {
  const vorstandRoleId = roles.find((r) => r.system_key === VORSTAND_ROLE_KEY)?.id;
  const assistantRoleId = roles.find((r) => r.system_key === 'assistant_coach')?.id;

  function update(index: number, patch: Partial<TeamRoleInput>) {
    const next = value.map((row, i) => {
      if (i !== index) return row;
      const merged = { ...row, ...patch };
      if (merged.role_id === vorstandRoleId) {
        // Vorstand gilt immer für alle Teams; statt des Teams wird das Ressort gewählt.
        merged.team_id = null;
        if (!merged.ressort_id) merged.ressort_id = ressorts[0]?.id ?? null;
      } else {
        merged.ressort_id = null;
        if (row.role_id === vorstandRoleId && merged.team_id === null) merged.team_id = teamOptions[0]?.teamId ?? null;
      }
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
    if (roles.length === 0) return;
    const defaultRole = roles.find((r) => r.system_key === 'assistant_coach') ?? roles[0];
    onChange([
      ...value,
      { team_id: teamOptions[0]?.teamId ?? null, role_id: defaultRole.id, ressort_id: null, finance_access: false },
    ]);
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((row, index) => {
        const isVorstand = row.role_id === vorstandRoleId;
        return (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border border-border p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:border-0 sm:p-0"
          >
            <Select
              aria-label="Rolle"
              value={row.role_id}
              onChange={(e) => update(index, { role_id: e.target.value })}
              className="col-start-1 row-start-1"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            {isVorstand ? (
              <Select
                aria-label="Ressort"
                required
                value={row.ressort_id ?? ''}
                onChange={(e) => update(index, { ressort_id: e.target.value || null })}
                className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
              >
                {!row.ressort_id && <option value="">Ressort wählen…</option>}
                {ressorts.map((r) => (
                  <option key={r.id} value={r.id}>
                    Ressort: {r.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                aria-label="Bereich"
                value={row.team_id ?? ALL_TEAMS}
                onChange={(e) => update(index, { team_id: e.target.value === ALL_TEAMS ? null : e.target.value })}
                className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
              >
                <option value={ALL_TEAMS}>Alle Teams</option>
                {teamOptions.map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.categoryName} · {t.teamName} ({t.season})
                  </option>
                ))}
              </Select>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => remove(index)}
              aria-label="Zeile entfernen"
              className="col-start-2 row-start-1 sm:col-start-3"
            >
              ✕
            </Button>
            {row.role_id === assistantRoleId && (
              <label className="col-span-2 flex items-center gap-2 text-sm text-text sm:col-span-3">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={row.finance_access}
                  onChange={(e) => update(index, { finance_access: e.target.checked })}
                />
                Finanzzugriff für dieses Team
              </label>
            )}
          </div>
        );
      })}
      <Button type="button" variant="secondary" size="sm" onClick={add} className="self-start" disabled={roles.length === 0}>
        + Zuweisung hinzufügen
      </Button>
    </div>
  );
}
