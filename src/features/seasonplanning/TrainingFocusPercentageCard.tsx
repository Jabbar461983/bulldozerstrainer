import { Card } from '../../components/Card';
import type { SeasonPlanningCategory } from '../../types/database';
import { useTrainingFocusPercentages } from './useSeasonPlanning';

interface TrainingFocusPercentageCardProps {
  trainingId: string;
}

const CATEGORY_NAMES: Record<SeasonPlanningCategory, string> = {
  activities: 'Aktivitäten',
  technique: 'Technik',
  tactics: 'Taktik',
  physical: 'Physis',
};

const CATEGORY_COLORS: Record<SeasonPlanningCategory, string> = {
  activities: 'bg-red-500',
  technique: 'bg-blue-500',
  tactics: 'bg-red-500',
  physical: 'bg-green-500',
};

export function TrainingFocusPercentageCard({ trainingId }: TrainingFocusPercentageCardProps) {
  const { percentages, setPercentage, loading } = useTrainingFocusPercentages(trainingId);

  if (loading) {
    return <Card>Lädt Fokus-Aufteilung...</Card>;
  }

  const total = Object.values(percentages).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-text">Trainingszeit-Aufteilung</h3>
          <p className="text-sm text-text-muted">
            Prozentuale Aufteilung der Trainingszeit nach Kategorie
          </p>
        </div>

        <div className="space-y-3">
          {Object.entries(CATEGORY_NAMES).map(([category, label]) => {
            const percentage = percentages[category as SeasonPlanningCategory];
            return (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-text">{label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={percentage}
                      onChange={(e) => {
                        const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                        void setPercentage(category as SeasonPlanningCategory, value);
                      }}
                      className="w-12 rounded border border-border bg-background px-2 py-1 text-right text-sm text-text"
                    />
                    <span className="w-8 text-right text-sm text-text-muted">%</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-background">
                  <div
                    className={`h-full rounded-full ${CATEGORY_COLORS[category as SeasonPlanningCategory]} transition-all`}
                    style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {total !== 100 && (
          <div className="rounded bg-yellow-50 p-2 text-xs text-yellow-900">
            ℹ️ Summe: {total}% (Ziel: 100%)
          </div>
        )}
      </div>
    </Card>
  );
}
