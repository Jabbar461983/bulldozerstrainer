import clsx from 'clsx';
import type { TrainingFieldType } from '../../types/database';

interface FieldTypeToggleProps {
  value: TrainingFieldType;
  onChange: (value: TrainingFieldType) => void;
}

export function FieldTypeToggle({ value, onChange }: FieldTypeToggleProps) {
  return (
    <span className="inline-flex shrink-0 rounded-full border border-border bg-surface-alt p-0.5 text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange('on_field')}
        className={clsx(
          'rounded-full px-2.5 py-1 transition',
          value === 'on_field' ? 'bg-accent text-accent-foreground' : 'text-text-muted',
        )}
      >
        On Field
      </button>
      <button
        type="button"
        onClick={() => onChange('off_field')}
        className={clsx(
          'rounded-full px-2.5 py-1 transition',
          value === 'off_field' ? 'bg-accent text-accent-foreground' : 'text-text-muted',
        )}
      >
        Off Field
      </button>
    </span>
  );
}
