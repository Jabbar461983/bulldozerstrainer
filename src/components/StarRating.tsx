import clsx from 'clsx';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StarRating({ value, onChange, readOnly = false, size = 'md' }: StarRatingProps) {
  const sizeClass = size === 'sm' ? 'size-5' : size === 'lg' ? 'size-10' : 'size-8';
  return (
    <div className="flex gap-1" role={readOnly ? undefined : 'radiogroup'} aria-label="Bewertung">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          aria-label={`${star} Sterne`}
          aria-checked={value === star}
          role={readOnly ? undefined : 'radio'}
          onClick={() => onChange?.(star)}
          className={clsx(
            'flex items-center justify-center rounded-lg transition',
            !readOnly && 'min-h-11 min-w-11 hover:bg-surface-alt active:scale-95',
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className={clsx(sizeClass, star <= value ? 'fill-warning' : 'fill-none')}
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              d="M12 2.5l2.9 6.24 6.6.7-4.9 4.6 1.3 6.7-5.9-3.4-5.9 3.4 1.3-6.7-4.9-4.6 6.6-.7z"
              className="text-warning"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}
