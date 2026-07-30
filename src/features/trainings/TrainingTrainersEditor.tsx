import type { RosterTrainer } from '../../lib/roster';

interface TrainingTrainersEditorProps {
  trainers: RosterTrainer[];
  selectedIds: string[];
  onToggle: (trainerId: string) => void;
  loading: boolean;
  error: string | null;
}

export function TrainingTrainersEditor({ trainers, selectedIds, onToggle, loading, error }: TrainingTrainersEditorProps) {
  if (loading) {
    return error ? (
      <p className="text-sm text-danger">{error}</p>
    ) : (
      <p className="text-sm text-text-muted">Lädt…</p>
    );
  }
  if (trainers.length === 0) {
    return <p className="text-sm text-text-muted">Diesem Team sind noch keine Trainer zugewiesen.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {trainers.map((t) => (
          <label
            key={t.trainerId}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-text"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(t.trainerId)}
              onChange={() => onToggle(t.trainerId)}
            />
            {t.firstName} {t.lastName}
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
