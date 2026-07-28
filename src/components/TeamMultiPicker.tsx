import type { TeamOption } from '../lib/teams';

interface TeamMultiPickerProps {
  teamOptions: TeamOption[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function TeamMultiPicker({ teamOptions, value, onChange }: TeamMultiPickerProps) {
  function toggle(teamId: string) {
    if (value.includes(teamId)) {
      onChange(value.filter((id) => id !== teamId));
    } else {
      onChange([...value, teamId]);
    }
  }

  if (teamOptions.length === 0) {
    return <p className="text-sm text-text-muted">Keine Teams verfügbar.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {teamOptions.map((t) => (
        <label
          key={t.teamId}
          className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text"
        >
          <input
            type="checkbox"
            className="size-5"
            checked={value.includes(t.teamId)}
            onChange={() => toggle(t.teamId)}
          />
          {t.categoryName} · {t.teamName} ({t.season})
        </label>
      ))}
    </div>
  );
}
