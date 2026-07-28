import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Select } from '../../components/Select';
import { OfflineNotice } from '../../components/OfflineNotice';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import { todayIso } from '../../lib/dates';
import { withCache } from '../../lib/withCache';
import { fetchTrainings } from './api';
import type { Training } from '../../types/database';
import { CreateTrainingDialog } from './CreateTrainingDialog';
import { TrainingDetailDialog } from './TrainingDetailDialog';

export function TrainingsPage() {
  const [teamOptions, setTeamOptions] = useState<TeamOption[] | null>(null);
  const [teamId, setTeamId] = useState('');
  const [trainings, setTrainings] = useState<Training[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineCachedAt, setOfflineCachedAt] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);

  useEffect(() => {
    withCache('team-options', fetchTeamOptions)
      .then((result) => {
        setTeamOptions(result.data);
        if (result.data.length > 0) setTeamId(result.data[0].teamId);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Teams konnten nicht geladen werden.'));
  }, []);

  async function load(currentTeamId: string) {
    if (!currentTeamId) return;
    setError(null);
    try {
      const result = await withCache(`trainings:${currentTeamId}`, () => fetchTrainings(currentTeamId));
      setTrainings(result.data);
      setOfflineCachedAt(result.fromCache ? result.cachedAt : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trainings konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    if (teamId) void load(teamId);
  }, [teamId]);

  const { upcoming, past } = useMemo(() => {
    const today = todayIso();
    const upcoming = (trainings ?? []).filter((t) => t.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const past = (trainings ?? []).filter((t) => t.date < today);
    return { upcoming, past };
  }, [trainings]);

  function renderTraining(training: Training) {
    return (
      <Card
        key={training.id}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedTraining(training)}
        onKeyDown={(e) => e.key === 'Enter' && setSelectedTraining(training)}
        className="cursor-pointer"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium text-text">
              {new Date(`${training.date}T00:00:00`).toLocaleDateString('de-CH', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
              {training.start_time && ` · ${training.start_time.slice(0, 5)}`}
            </p>
            <p className="text-sm text-text-muted">{training.duration_minutes} Min.</p>
          </div>
        </div>
        {training.notes && <p className="mt-1 truncate text-sm text-text-muted">{training.notes}</p>}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">Training</h1>
        <Button disabled={!teamId} onClick={() => setShowCreate(true)}>
          + Neues Training
        </Button>
      </div>

      {teamOptions !== null && teamOptions.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">
            Dir ist noch kein Team zugewiesen. Bitte wende dich an einen Admin.
          </p>
        </Card>
      )}

      {teamOptions && teamOptions.length > 0 && (
        <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {teamOptions.map((t) => (
            <option key={t.teamId} value={t.teamId}>
              {t.categoryName} · {t.teamName} ({t.season})
            </option>
          ))}
        </Select>
      )}

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {offlineCachedAt && <OfflineNotice cachedAt={offlineCachedAt} />}

      {trainings === null && teamId && <p className="text-sm text-text-muted">Lädt…</p>}

      {trainings !== null && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text-muted">Kommende Trainings</h2>
            {upcoming.length === 0 && (
              <Card>
                <p className="text-sm text-text-muted">Keine kommenden Trainings geplant.</p>
              </Card>
            )}
            <div className="flex flex-col gap-2">{upcoming.map(renderTraining)}</div>
          </div>

          {past.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-text-muted">Vergangene Trainings</h2>
              <div className="flex flex-col gap-2">{past.map(renderTraining)}</div>
            </div>
          )}
        </div>
      )}

      {showCreate && teamId && (
        <CreateTrainingDialog
          teamId={teamId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load(teamId);
          }}
        />
      )}

      {selectedTraining && (
        <TrainingDetailDialog
          training={selectedTraining}
          onClose={() => setSelectedTraining(null)}
          onSaved={() => {
            setSelectedTraining(null);
            void load(teamId);
          }}
          onDeleted={() => {
            setSelectedTraining(null);
            void load(teamId);
          }}
        />
      )}
    </div>
  );
}
