import { useState, useRef } from 'react';
import { Button } from '../../components/Button';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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

interface EventWithPosition extends SeasonPlanningEvent {
  startDay: number;
  endDay: number;
  duration: number;
  row: number;
}

export function SeasonPlanningCalendar({
  events,
  season,
  onEditEvent,
  categoryColors,
  categoryNames,
}: SeasonPlanningCalendarProps) {
  const [startYear] = season.split('/').map(Number);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

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

  const getEventPosition = (event: SeasonPlanningEvent, row: number) => {
    const startDay = getDayOfSeason(event.start_date);
    const endDay = getDayOfSeason(event.end_date);
    const duration = endDay - startDay + 1;
    const totalDays = getTotalSeasonDays();

    const leftPercent = (startDay / totalDays) * 100;
    const widthPercent = (Math.max(1, duration) / totalDays) * 100;

    return {
      left: `${leftPercent}%`,
      width: `${Math.max(1, widthPercent)}%`,
      top: `${row * 18 + 4}px`,
    };
  };

  const isSingleDay = (event: SeasonPlanningEvent): boolean => {
    const startDay = getDayOfSeason(event.start_date);
    const endDay = getDayOfSeason(event.end_date);
    return endDay - startDay < 1;
  };

  const getStackedEvents = (category: SeasonPlanningCategory): EventWithPosition[] => {
    const categoryEventsList = events
      .filter((e) => e.category === category)
      .map((e) => ({
        ...e,
        startDay: getDayOfSeason(e.start_date),
        endDay: getDayOfSeason(e.end_date),
        duration: getDayOfSeason(e.end_date) - getDayOfSeason(e.start_date) + 1,
        row: 0,
      }));

    const sortedEvents = categoryEventsList.sort((a, b) => a.startDay - b.startDay);
    const rows: EventWithPosition[][] = [];

    for (const event of sortedEvents) {
      let placed = false;
      for (let r = 0; r < rows.length; r++) {
        const overlaps = rows[r].some(
          (e) => !(event.endDay < e.startDay || event.startDay > e.endDay)
        );
        if (!overlaps) {
          rows[r].push({ ...event, row: r });
          placed = true;
          break;
        }
      }
      if (!placed) {
        rows.push([{ ...event, row: rows.length }]);
      }
    }

    return rows.flat();
  };

  const categoryEvents = (category: SeasonPlanningCategory) => {
    return getStackedEvents(category);
  };

  const exportToPDF = async () => {
    if (!calendarRef.current) return;

    try {
      const canvas = await html2canvas(calendarRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Saisonplanung-${season}.pdf`);
    } catch (error) {
      console.error('PDF Export failed:', error);
    }
  };

  const totalDays = getTotalSeasonDays();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={exportToPDF}>PDF exportieren</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface p-4" ref={calendarRef}>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4">
          {CATEGORIES.map((category) => (
            <div key={category} className="flex items-center gap-2">
              <div className={`h-4 w-4 rounded ${categoryColors[category].split(' ')[0]}`} />
              <span className="text-sm text-text">{categoryNames[category]}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm text-text">Ein Tag oder weniger</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="relative w-full min-w-max">
          {/* Month headers */}
          <div className="flex mb-2">
            <div className="w-24 flex-shrink-0" />
            <div className="flex flex-1">
              {MONTHS.map((month, idx) => {
                const daysInMonth = MONTH_DAYS[idx];
                const dayPercent = (daysInMonth / totalDays) * 100;
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
          {CATEGORIES.map((category) => {
            const stackedEvents = categoryEvents(category);
            const maxRow = stackedEvents.length > 0 ? Math.max(...stackedEvents.map((e) => e.row)) : 0;
            const containerHeight = Math.max(60, (maxRow + 1) * 22 + 8);

            return (
              <div key={category} className="flex border-t border-border">
                {/* Category label */}
                <div className="w-24 flex-shrink-0 bg-background px-2 py-4 text-xs font-medium text-text border-r border-border">
                  {categoryNames[category]}
                </div>

                {/* Timeline container */}
                <div
                  className="flex-1 relative bg-background"
                  style={{ height: `${containerHeight}px` }}
                >
                  {/* Month separators */}
                  {MONTHS.map((month, idx) => (
                    <div
                      key={`sep-${month}`}
                      className="absolute top-0 bottom-0 border-r border-border"
                      style={{ left: `${(getMonthStartDay(idx + 1) / totalDays) * 100}%` }}
                    />
                  ))}

                  {/* Events */}
                  {stackedEvents.map((event) => {
                    const single = isSingleDay(event);
                    const position = getEventPosition(event, event.row);

                    return single ? (
                      /* Single day event - red dot */
                      <div
                        key={event.id}
                        className="absolute group cursor-pointer"
                        style={{
                          left: position.left,
                          top: `calc(50% - 6px)`,
                          transform: 'translateX(-50%)',
                        }}
                        onMouseEnter={() => setHoveredEventId(event.id)}
                        onMouseLeave={() => setHoveredEventId(null)}
                      >
                        <div
                          className="h-3 w-3 rounded-full bg-red-500 border border-red-600 cursor-pointer"
                          onClick={() => onEditEvent(event)}
                        />
                        {hoveredEventId === event.id && (
                          <div className="absolute left-1/2 -translate-x-1/2 -top-12 bg-text text-surface px-3 py-2 rounded text-xs whitespace-nowrap z-20 pointer-events-none">
                            {event.title || event.subcategory || 'Event'}
                            {event.notes && <div className="text-xs mt-1 font-normal">{event.notes}</div>}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Multi-day event - bar */
                      <button
                        key={event.id}
                        onClick={() => onEditEvent(event)}
                        onMouseEnter={() => setHoveredEventId(event.id)}
                        onMouseLeave={() => setHoveredEventId(null)}
                        className={`absolute rounded border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 overflow-hidden ${
                          categoryColors[event.category]
                        }`}
                        style={{
                          ...position,
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title={event.title || event.subcategory || ''}
                      >
                        <span className="truncate text-xs">
                          {event.title || event.subcategory || 'Event'}
                        </span>

                        {/* Tooltip for notes */}
                        {event.notes && hoveredEventId === event.id && (
                          <div className="absolute left-1/2 -translate-x-1/2 -top-12 bg-text text-surface px-3 py-2 rounded text-xs whitespace-nowrap z-20 pointer-events-none shadow-lg">
                            {event.notes}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
