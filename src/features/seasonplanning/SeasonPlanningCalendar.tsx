import type { SeasonPlanningEvent, SeasonPlanningCategory } from '../../types/database';

interface SeasonPlanningCalendarProps {
  events: SeasonPlanningEvent[];
  season: string;
  onEditEvent: (event: SeasonPlanningEvent) => void;
  categoryColors: Record<SeasonPlanningCategory, string>;
  categoryNames: Record<SeasonPlanningCategory, string>;
}

const MONTHS = [
  { name: 'Juli', startDate: 0 },
  { name: 'August', startDate: 31 },
  { name: 'September', startDate: 62 },
  { name: 'Oktober', startDate: 92 },
  { name: 'November', startDate: 123 },
  { name: 'Dezember', startDate: 153 },
  { name: 'Januar', startDate: 184 },
  { name: 'Februar', startDate: 212 },
  { name: 'März', startDate: 243 },
  { name: 'April', startDate: 273 },
  { name: 'Mai', startDate: 304 },
];

export function SeasonPlanningCalendar({
  events,
  season,
  onEditEvent,
  categoryColors,
  categoryNames,
}: SeasonPlanningCalendarProps) {
  const [startYear] = season.split('/').map(Number);

  // Calculate pixel width for each event based on date range
  const getEventStyle = (event: SeasonPlanningEvent) => {
    const start = new Date(`${event.start_date}T00:00:00`);
    const end = new Date(`${event.end_date}T00:00:00`);
    const seasonStart = new Date(`${startYear}-07-01T00:00:00`);
    const seasonEnd = new Date(`${startYear + 1}-05-31T23:59:59`);

    const totalDays = Math.ceil((seasonEnd.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
    const startOffset = Math.ceil((start.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const startPercent = (startOffset / totalDays) * 100;
    const widthPercent = (Math.max(1, duration) / totalDays) * 100;

    return {
      left: `${startPercent}%`,
      width: `${Math.max(2, widthPercent)}%`,
    };
  };

  return (
    <div className="space-y-6 overflow-x-auto rounded-lg border border-border bg-surface p-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(categoryNames).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded ${categoryColors[key as SeasonPlanningCategory].split(' ')[0]}`} />
            <span className="text-sm text-text">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="space-y-3">
        {MONTHS.map((month) => (
          <div key={month.name} className="flex gap-4">
            <div className="w-20 flex-shrink-0">
              <p className="text-sm font-medium text-text">{month.name}</p>
            </div>
            <div className="relative flex-1 h-12 bg-background rounded border border-border">
              {events
                .filter((e) => {
                  const start = new Date(`${e.start_date}T00:00:00`);
                  const end = new Date(`${e.end_date}T00:00:00`);
                  const seasonStart = new Date(`${startYear}-07-01T00:00:00`);
                  const nextMonthStart = month.name === 'Mai'
                    ? new Date(`${startYear + 1}-06-01T00:00:00`)
                    : new Date(`${startYear}-${String(MONTHS.indexOf(month) + 8).padStart(2, '0')}-01T00:00:00`);

                  return !(end < seasonStart || start >= nextMonthStart);
                })
                .map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onEditEvent(event)}
                    className={`absolute top-1 h-10 rounded border px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${categoryColors[event.category]}`}
                    style={getEventStyle(event)}
                    title={event.title}
                  >
                    <span className="truncate block">{event.title}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
