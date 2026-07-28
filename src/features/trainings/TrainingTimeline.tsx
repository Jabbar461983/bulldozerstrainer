interface TimelineItem {
  id: string;
  title: string;
  durationMinutes: number;
}

interface TrainingTimelineProps {
  totalMinutes: number;
  items: TimelineItem[];
}

const SEGMENT_COLORS = ['bg-accent', 'bg-gold', 'bg-success', 'bg-warning', 'bg-danger'];

export function TrainingTimeline({ totalMinutes, items }: TrainingTimelineProps) {
  const plannedMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
  const barTotal = Math.max(totalMinutes, plannedMinutes, 1);

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Noch keine Übungen eingeplant.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-8 w-full overflow-hidden rounded-lg border border-border">
        {items.map((item, i) => (
          <div
            key={item.id}
            title={`${item.title} (${item.durationMinutes} Min.)`}
            className={`${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} flex items-center justify-center text-[10px] font-medium text-white/90`}
            style={{ width: `${(item.durationMinutes / barTotal) * 100}%` }}
          >
            {item.durationMinutes >= 8 ? item.durationMinutes : ''}
          </div>
        ))}
      </div>
      {plannedMinutes !== totalMinutes && (
        <p className="text-xs text-warning">
          Geplante Übungsdauer ({plannedMinutes} Min.) weicht von der Trainingsdauer ({totalMinutes} Min.) ab.
        </p>
      )}
    </div>
  );
}
