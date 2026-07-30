import { useEffect, useState } from 'react';
import type { SeasonPlanningEvent, TrainingSeasonFocus, SeasonPlanningCategory } from '../../types/database';
import {
  fetchSeasonPlanningEvents,
  fetchApplicableSeasonPlanningEvents,
  fetchTrainingSeasonFocuses,
  fetchTrainingFocusPercentages,
  addTrainingSeasonFocus,
  removeTrainingSeasonFocus,
  setTrainingFocusPercentage,
  getSeasonDateRange,
  fetchSeasonPlanningEventsByDateRange,
} from './api';

export function useSeasonPlanningEvents(teamId: string | null) {
  const [events, setEvents] = useState<SeasonPlanningEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) {
      setEvents(null);
      return;
    }

    setLoading(true);
    fetchSeasonPlanningEvents(teamId)
      .then(setEvents)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to fetch season planning events'))
      .finally(() => setLoading(false));
  }, [teamId]);

  return { events, error, loading };
}

export function useApplicableSeasonPlanningEvents(teamId: string | null, trainingDate: string | null) {
  const [events, setEvents] = useState<SeasonPlanningEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId || !trainingDate) {
      setEvents([]);
      return;
    }

    setLoading(true);
    fetchApplicableSeasonPlanningEvents(teamId, trainingDate)
      .then(setEvents)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to fetch applicable events'))
      .finally(() => setLoading(false));
  }, [teamId, trainingDate]);

  return { events, error, loading };
}

export function useTrainingSeasonFocuses(trainingId: string | null) {
  const [focuses, setFocuses] = useState<TrainingSeasonFocus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!trainingId) return;
    setLoading(true);
    try {
      const data = await fetchTrainingSeasonFocuses(trainingId);
      setFocuses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch training focuses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [trainingId]);

  const add = async (eventId: string) => {
    if (!trainingId) return;
    try {
      await addTrainingSeasonFocus(trainingId, eventId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add focus');
    }
  };

  const remove = async (eventId: string) => {
    if (!trainingId) return;
    try {
      await removeTrainingSeasonFocus(trainingId, eventId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove focus');
    }
  };

  return { focuses, error, loading, add, remove, refresh };
}

export function useTrainingFocusPercentages(trainingId: string | null) {
  const [percentages, setPercentages] = useState<Record<SeasonPlanningCategory, number>>({
    activities: 0,
    technique: 0,
    tactics: 0,
    physical: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!trainingId) return;

    setLoading(true);
    fetchTrainingFocusPercentages(trainingId)
      .then(setPercentages)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to fetch percentages'))
      .finally(() => setLoading(false));
  }, [trainingId]);

  const setPercentage = async (category: SeasonPlanningCategory, percentage: number) => {
    if (!trainingId) return;
    try {
      await setTrainingFocusPercentage(trainingId, category, percentage);
      setPercentages((prev) => ({ ...prev, [category]: percentage }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set percentage');
    }
  };

  return { percentages, error, loading, setPercentage };
}

export function useSeasonDateRange(season: string | null) {
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!season) {
      setDateRange(null);
      return;
    }

    getSeasonDateRange(season)
      .then(setDateRange)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to get season date range'));
  }, [season]);

  return { dateRange, error };
}

export function useSeasonPlanningEventsByDateRange(teamId: string | null, season: string | null) {
  const [events, setEvents] = useState<SeasonPlanningEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { dateRange } = useSeasonDateRange(season);

  const refresh = async () => {
    if (!teamId || !dateRange) {
      setEvents([]);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchSeasonPlanningEventsByDateRange(teamId, dateRange.startDate, dateRange.endDate);
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [teamId, dateRange]);

  return { events, error, loading, refresh };
}
