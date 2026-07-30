import { useEffect, useState } from 'react';
import type { SeasonPlanningCategory } from '../../types/database';
import { useApplicableSeasonPlanningEvents } from './useSeasonPlanning';
import { computeTrainingFocusPercentages } from './api';
import { SEASON_CATEGORY_NAMES as CATEGORY_NAMES, SEASON_CATEGORY_ORDER as CATEGORY_ORDER } from './categories';

interface TrainingSeasonSummaryProps {
  teamId: string;
  trainingId: string;
  trainingDate: string;
}

export function TrainingSeasonSummary({ teamId, trainingId, trainingDate }: TrainingSeasonSummaryProps) {
  const { events, loading: eventsLoading } = useApplicableSeasonPlanningEvents(teamId, trainingDate);
  const [percentages, setPercentages] = useState<Record<SeasonPlanningCategory, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventsLoading) return;
    let cancelled = false;
    computeTrainingFocusPercentages(trainingId, events)
      .then((result) => {
        if (!cancelled) setPercentages(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Prozente konnten nicht berechnet werden.');
      });
    return () => {
      cancelled = true;
    };
  }, [trainingId, eventsLoading, events]);

  if (percentages === null && !error) return null;

  const focusLine = CATEGORY_ORDER.map((cat) => {
    const titles = events
      .filter((e) => e.category === cat)
      .map((e) => e.title || e.subcategory)
      .filter((t): t is string => !!t);
    return titles.length > 0 ? `${CATEGORY_NAMES[cat]}: ${titles.join(', ')}` : null;
  })
    .filter((s): s is string => !!s)
    .join(' · ');

  const percentageLine = percentages
    ? CATEGORY_ORDER.map((cat) => `${CATEGORY_NAMES[cat]}: ${percentages[cat]}%`).join(' · ')
    : null;

  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-surface-alt px-3 py-2 text-xs text-text-muted">
      {focusLine && <p>Saisonplanung: {focusLine}</p>}
      {percentageLine && <p>Zeitanteil: {percentageLine}</p>}
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
