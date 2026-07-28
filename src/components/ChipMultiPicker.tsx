import clsx from 'clsx';

export interface ChipOption {
  value: string;
  label: string;
}

interface ChipMultiPickerProps {
  options: ChipOption[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function ChipMultiPicker({ options, value, onChange }: ChipMultiPickerProps) {
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className={clsx(
            'flex min-h-9 cursor-pointer items-center rounded-full border px-3.5 py-2 text-sm transition',
            value.includes(o.value)
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-text-muted hover:bg-surface-alt',
          )}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={value.includes(o.value)}
            onChange={() => toggle(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
