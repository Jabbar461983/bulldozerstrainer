import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import type { TrainingExerciseRow } from './api';

interface TrainingExerciseDetailDialogProps {
  row: TrainingExerciseRow;
  busy: boolean;
  onClose: () => void;
  onDurationChange: (duration: number) => void;
  onRemove: () => void;
}

export function TrainingExerciseDetailDialog({
  row,
  busy,
  onClose,
  onDurationChange,
  onRemove,
}: TrainingExerciseDetailDialogProps) {
  return (
    <Modal title={row.exerciseTitle} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">Dauer</span>
          <div className="w-20">
            <Input
              type="number"
              min={1}
              value={row.duration_minutes}
              disabled={busy}
              onChange={(e) => onDurationChange(Number(e.target.value))}
              className="text-center"
            />
          </div>
          <span className="text-sm text-text-muted">Min.</span>
        </div>

        {row.exerciseDescription && (
          <div>
            <h2 className="mb-1 text-sm font-semibold text-text-muted">Beschreibung</h2>
            <p className="whitespace-pre-wrap text-sm text-text">{row.exerciseDescription}</p>
          </div>
        )}

        {row.exerciseCoachingQuestions && (
          <div>
            <h2 className="mb-1 text-sm font-semibold text-text-muted">Coachingfragen</h2>
            <p className="whitespace-pre-wrap text-sm text-text">{row.exerciseCoachingQuestions}</p>
          </div>
        )}

        {row.exerciseVariants && (
          <div>
            <h2 className="mb-1 text-sm font-semibold text-text-muted">Varianten</h2>
            <p className="whitespace-pre-wrap text-sm text-text">{row.exerciseVariants}</p>
          </div>
        )}

        {row.media.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {row.media.map((m) =>
              m.type === 'image' ? (
                <img
                  key={m.path}
                  src={m.url ?? ''}
                  alt=""
                  className="h-28 w-40 rounded-lg border border-border object-cover"
                />
              ) : (
                <video key={m.path} src={m.url ?? ''} controls className="h-28 w-44 rounded-lg border border-border" />
              ),
            )}
          </div>
        )}

        <div className="flex justify-end border-t border-border pt-3">
          <Button type="button" variant="danger" disabled={busy} onClick={onRemove}>
            Übung entfernen
          </Button>
        </div>
      </div>
    </Modal>
  );
}
