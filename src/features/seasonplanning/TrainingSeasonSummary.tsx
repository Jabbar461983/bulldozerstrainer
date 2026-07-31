import { useEffect, useState } from 'react';
import { useApplicableSeasonPlanningEvents } from './useSeasonPlanning';
import { computeTrainingSeasonCoverage } from './api';
import { SEASON_CATEGORY_NAMES as CATEGORY_NAMES, SEASON_CATEGORY_ORDER as CATEGORY_ORDER } from './categories';

interface TrainingSeasonSummaryProps {
  teamId: string;
  trainingId: string;
  trainingDate: string;
}

export function TrainingSeasonSummary({ teamId, trainingId, trainingDate }: TrainingSeasonSummaryProps) {
  const { events, loading: eventsLoading } = useApplicableSeasonPlanningEvents(teamId, trainingDate);
  const [coverage, setCoverage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventsLoading) return;
    let cancelled = false;
    computeTrainingSeasonCoverage(trainingId, events)
      .then((result) => {
        if (!cancelled) setCoverage(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Prozentzahl konnte nicht berechnet werden.');
      });
    return () => {
      cancelled = true;
    };
  }, [trainingId, eventsLoading, events]);

  if (coverage === null && !error) return null;

  const focusLine = CATEGORY_ORDER.map((cat) => {
    const titles = events
      .filter((e) => e.category === cat)
      .map((e) => e.title || e.subcategory)
      .filter((t): t is string => !!t);
    return titles.length > 0 ? `${CATEGORY_NAMES[cat]}: ${titles.join(', ')}` : null;
  })
    .filter((s): s is string => !!s)
    .join(' · ');

  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-surface-alt px-3 py-2 text-xs text-text-muted">
      {focusLine && <p>Saisonplanung: {focusLine}</p>}
      {coverage !== null && <p>{coverage}% der Trainingseinheit gemäss Saisonplanung</p>}
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
