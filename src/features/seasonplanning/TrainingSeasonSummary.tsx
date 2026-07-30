import { useEffect, useState } from 'react';
import type { SeasonPlanningCategory } from '../../types/database';
import { useApplicableSeasonPlanningEvents } from './useSeasonPlanning';
import { computeTrainingFocusPercentages } from './api';

interface TrainingSeasonSummaryProps {
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

const CATEGORY_ORDER: SeasonPlanningCategory[] = ['technique', 'tactics', 'physical', 'activities'];

export function TrainingSeasonSummary({ teamId, trainingId, trainingDate }: TrainingSeasonSummaryProps) {
  const { events } = useApplicableSeasonPlanningEvents(teamId, trainingDate);
  const [percentages, setPercentages] = useState<Record<SeasonPlanningCategory, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    computeTrainingFocusPercentages(trainingId)
      .then((result) => {
        if (!cancelled) setPercentages(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Prozente konnten nicht berechnet werden.');
      });
    return () => {
      cancelled = true;
    };
  }, [trainingId]);

  if (percentages === null && !error) return null;

  const focusLine = CATEGORY_ORDER.map((cat) => {
    const titles = events.filter((e) => e.category === cat).map((e) => e.title);
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
