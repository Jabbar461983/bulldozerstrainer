import { useState } from 'react';
import { Card } from '../../components/Card';
import type { SeasonPlanningCategory } from '../../types/database';
import { useApplicableSeasonPlanningEvents, useTrainingSeasonFocuses } from './useSeasonPlanning';

interface TrainingSeasonPlanningCardProps {
  teamId: string;
  trainingId: string;
  trainingDate: string;
}

const CATEGORY_NAMES: Record<SeasonPlanningCategory, string> = {
  activities: 'Aktivitäten',
  technique: 'Technik',
  tactics: 'Taktik',
  physical: 'Physis',
};

const CATEGORY_COLORS: Record<SeasonPlanningCategory, string> = {
  activities: 'bg-red-50 border-red-200 text-red-900',
  technique: 'bg-blue-50 border-blue-200 text-blue-900',
  tactics: 'bg-red-50 border-red-200 text-red-900',
  physical: 'bg-green-50 border-green-200 text-green-900',
};

export function TrainingSeasonPlanningCard({
  teamId,
  trainingId,
  trainingDate,
}: TrainingSeasonPlanningCardProps) {
  const { events: applicableEvents, loading: eventsLoading } = useApplicableSeasonPlanningEvents(
    teamId,
    trainingDate
  );
  const { focuses, add, remove, loading: focusesLoading } = useTrainingSeasonFocuses(trainingId);
  const [expandedCategory, setExpandedCategory] = useState<SeasonPlanningCategory | null>(null);

  if (eventsLoading || focusesLoading) {
    return <Card>Lädt Saisonplanung...</Card>;
  }

  if (applicableEvents.length === 0) {
    return null;
  }

  const focusIds = new Set(focuses.map((f) => f.season_planning_event_id));
  const hasAnyFocus = focusIds.size > 0;

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-text">Saisonplanung Schwerpunkte</h3>
            <p className="text-sm text-text-muted">
              Markieren Sie die Schwerpunkte, die in diesem Training behandelt werden
            </p>
          </div>
          {!hasAnyFocus && (
            <div className="rounded bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-900">
              ⚠️ Keine Schwerpunkte
            </div>
          )}
        </div>

        <div className="space-y-2">
          {Object.entries(CATEGORY_NAMES).map(([category, label]) => {
            const categoryEvents = applicableEvents.filter((e) => e.category === category);
            if (categoryEvents.length === 0) return null;

            const isExpanded = expandedCategory === category;

            return (
              <div key={category} className="space-y-1">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : (category as SeasonPlanningCategory))}
                  className={`w-full flex items-center justify-between rounded border px-3 py-2 text-sm font-medium transition-colors ${CATEGORY_COLORS[category as SeasonPlanningCategory]}`}
                >
                  <span>{label}</span>
                  <span>{isExpanded ? '▼' : '▶'}</span>
                </button>

                {isExpanded && (
                  <div className="space-y-1 pl-3">
                    {categoryEvents.map((event) => {
                      const isFocused = focusIds.has(event.id);
                      return (
                        <label key={event.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={isFocused}
                            onChange={(e) => {
                              if (e.target.checked) {
                                void add(event.id);
                              } else {
                                void remove(event.id);
                              }
                            }}
                            className="h-4 w-4 rounded border-border"
                          />
                          <span className="text-text">{event.title}</span>
                          {event.subcategory && (
                            <span className="text-xs text-text-muted">({event.subcategory})</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
