import type { SeasonPlanningCategory } from '../../types/database';

export const SEASON_CATEGORY_NAMES: Record<SeasonPlanningCategory, string> = {
  activities: 'Aktivitäten',
  technique: 'Technik',
  tactics: 'Taktik',
  physical: 'Physis',
};

export const SEASON_CATEGORY_ORDER: SeasonPlanningCategory[] = ['technique', 'tactics', 'physical', 'activities'];
