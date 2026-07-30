import { useState } from 'react';
import type { SeasonPlanningEvent, SeasonPlanningCategory } from '../../types/database';

interface SeasonPlanningCalendarProps {
  events: SeasonPlanningEvent[];
  season: string;
  onEditEvent: (event: SeasonPlanningEvent) => void;
  categoryColors: Record<SeasonPlanningCategory, string>;
  categoryNames: Record<SeasonPlanningCategory, string>;
}

const MONTHS = ['Juli', 'August', 'September', 'Oktober', 'November', 'Dezember', 'Januar', 'Februar', 'März', 'April', 'Mai'];
const CATEGORIES: SeasonPlanningCategory[] = ['activities', 'technique', 'tactics', 'physical'];

const MONTH_DAYS = [31, 31, 30, 31, 30, 31, 31, 28, 31, 30, 31];

export function SeasonPlanningCalendar({
  events,
  season,
  onEditEvent,
  categoryColors,
  categoryNames,
}: SeasonPlanningCalendarProps) {
  const [startYear] = season.split('/').map(Number);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  const getDayOfSeason = (dateStr: string): number => {
    const date = new Date(`${dateStr}T00:00:00`);
    const seasonStart = new Date(`${startYear}-07-01T00:00:00`);
    const days = Math.floor((date.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const getTotalSeasonDays = (): number => {
    const seasonStart = new Date(`${startYear}-07-01T00:00:00`);
    const seasonEnd = new Date(`${startYear + 1}-05-31T23:59:59`);
    return Math.ceil((seasonEnd.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getMonthStartDay = (monthIndex: number): number => {
    return MONTH_DAYS.slice(0, monthIndex).reduce((sum, days) => sum + days, 0);
  };

  const getEventPosition = (event: SeasonPlanningEvent) => {
    const startDay = getDayOfSeason(event.start_date);
    const endDay = getDayOfSeason(event.end_date);
    const totalDays = getTotalSeasonDays();

    const leftPercent = (startDay / totalDays) * 100;
    const widthPercent = ((endDay - startDay + 1) / totalDays) * 100;

    return {
      left: `${leftPercent}%`,
      width: `${Math.max(1, widthPercent)}%`,
    };
  };

  const categoryEvents = (category: SeasonPlanningCategory) => {
    return events.filter((e) => e.category === category);
  };

  return (
    <div className="space-y-4 overflow-x-auto rounded-lg border border-border bg-surface p-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {CATEGORIES.map((category) => (
          <div key={category} className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded ${categoryColors[category].split(' ')[0]}`} />
            <span className="text-sm text-text">{categoryNames[category]}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="relative w-full min-w-max">
        {/* Month headers */}
        <div className="flex mb-2">
          <div className="w-24 flex-shrink-0" />
          <div className="flex flex-1">
            {MONTHS.map((month, idx) => {
              const daysInMonth = MONTH_DAYS[idx];
              const dayPercent = (daysInMonth / getTotalSeasonDays()) * 100;
              return (
                <div
                  key={month}
                  className="flex-shrink-0 border-r border-border px-2 py-1 text-xs font-semibold text-text text-center"
                  style={{ width: `${dayPercent}%`, minWidth: '80px' }}
                >
                  {month}
                </div>
              );
            })}
          </div>
        </div>

        {/* Category rows */}
        {CATEGORIES.map((category) => (
          <div key={category} className="flex border-t border-border">
            {/* Category label */}
            <div className="w-24 flex-shrink-0 bg-background px-2 py-4 text-xs font-medium text-text border-r border-border">
              {categoryNames[category]}
            </div>

            {/* Timeline container */}
            <div className="flex-1 relative h-20 bg-background">
              {/* Month separators */}
              {MONTHS.map((month, idx) => (
                <div
                  key={`sep-${month}`}
                  className="absolute top-0 bottom-0 border-r border-border"
                  style={{ left: `${getMonthStartDay(idx + 1) / getTotalSeasonDays() * 100}%` }}
                />
              ))}

              {/* Events */}
              {categoryEvents(category).map((event) => (
                <button
                  key={event.id}
                  onClick={() => onEditEvent(event)}
                  onMouseEnter={() => setHoveredEventId(event.id)}
                  onMouseLeave={() => setHoveredEventId(null)}
                  className={`absolute top-2 h-16 rounded border px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80 overflow-hidden group ${
                    categoryColors[event.category]
                  }`}
                  style={getEventPosition(event)}
                  title={event.title}
                >
                  <span className="truncate block line-clamp-2">{event.title || event.subcategory || 'Event'}</span>

                  {/* Tooltip for notes */}
                  {event.notes && hoveredEventId === event.id && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-text text-surface px-3 py-2 rounded text-xs whitespace-nowrap z-10 pointer-events-none">
                      {event.notes}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
