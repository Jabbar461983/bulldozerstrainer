import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Select } from '../../components/Select';
import { StarRating } from '../../components/StarRating';
import { OfflineNotice } from '../../components/OfflineNotice';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import { todayIso } from '../../lib/dates';
import { withCache } from '../../lib/withCache';
import { fetchTrainings, fetchTrainingsOverview } from './api';
import type { TrainingOverviewInfo } from './api';
import type { Training } from '../../types/database';
import { CreateTrainingDialog } from './CreateTrainingDialog';
import { CopyTrainingDialog } from './CopyTrainingDialog';
import { TrainingDetailDialog } from './TrainingDetailDialog';
import { TrainingPresentation } from './TrainingPresentation';
import { computeSeasonCoverageForTrainings } from '../seasonplanning/api';

export function TrainingsPage() {
  const [teamOptions, setTeamOptions] = useState<TeamOption[] | null>(null);
  const [teamId, setTeamId] = useState('');
  const [trainings, setTrainings] = useState<Training[] | null>(null);
  const [overview, setOverview] = useState<Record<string, TrainingOverviewInfo>>({});
  const [seasonCoverage, setSeasonCoverage] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [offlineCachedAt, setOfflineCachedAt] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [presentingTraining, setPresentingTraining] = useState<Training | null>(null);

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
      const ids = result.data.map((t) => t.id);
      const overviewResult = await withCache(`training-overview:${currentTeamId}`, () => fetchTrainingsOverview(ids));
      setOverview(overviewResult.data);
      const coverageResult = await withCache(`training-season-coverage:${currentTeamId}`, () =>
        computeSeasonCoverageForTrainings(
          currentTeamId,
          result.data.map((t) => ({ id: t.id, date: t.date })),
        ),
      );
      setSeasonCoverage(coverageResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trainings konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    if (teamId) void load(teamId);
  }, [teamId]);

  const selectedTeam = teamOptions?.find((t) => t.teamId === teamId) ?? null;
  const teamLabel = selectedTeam ? `${selectedTeam.categoryName} · ${selectedTeam.teamName}` : '';

  const { upcoming, past } = useMemo(() => {
    const today = todayIso();
    const upcoming = (trainings ?? []).filter((t) => t.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const past = (trainings ?? []).filter((t) => t.date < today);
    return { upcoming, past };
  }, [trainings]);

  function renderTraining(training: Training) {
    const info = overview[training.id];
    return (
      <Card
        key={training.id}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedTraining(training)}
        onKeyDown={(e) => e.key === 'Enter' && setSelectedTraining(training)}
        className="cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
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
                <p className="text-sm text-text-muted">
                  {training.duration_minutes} Min.
                  {info && ` · ${info.plannedMinutes} Min. verplant`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {info?.ratingStars && <StarRating value={info.ratingStars} readOnly size="sm" />}
                <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent">
                  {training.field_type === 'off_field' ? 'Off Field' : 'On Field'}
                </span>
              </div>
            </div>
            {info?.ratingByName && <p className="mt-1 text-xs text-text-muted">Bewertet von {info.ratingByName}</p>}
            {info && info.plannedMinutes > 0 && (
              <p className="mt-1 text-xs text-text-muted">
                {seasonCoverage[training.id] ?? 0}% der Trainingseinheit gemäss Saisonplanung
              </p>
            )}
            {info && info.trainerNames.length > 0 && (
              <p className="mt-1 text-xs text-text-muted">Trainer: {info.trainerNames.join(', ')}</p>
            )}
            {training.notes && <p className="mt-1 truncate text-sm text-text-muted">{training.notes}</p>}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPresentingTraining(training);
            }}
            aria-label="Training abspielen"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-accent/10"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">Training</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={!teamId || !trainings || trainings.length === 0}
            onClick={() => setShowCopy(true)}
          >
            Kopieren
          </Button>
          <Button disabled={!teamId} onClick={() => setShowCreate(true)}>
            + Neues Training
          </Button>
        </div>
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

      {showCopy && teamId && (
        <CopyTrainingDialog
          teamId={teamId}
          trainings={trainings ?? []}
          onClose={() => setShowCopy(false)}
          onCreated={() => {
            setShowCopy(false);
            void load(teamId);
          }}
        />
      )}

      {selectedTraining && (
        <TrainingDetailDialog
          training={selectedTraining}
          teamLabel={teamLabel}
          categoryId={selectedTeam?.categoryId ?? ''}
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

      {presentingTraining && (
        <TrainingPresentation
          training={presentingTraining}
          teamId={teamId}
          trainings={trainings ?? []}
          onClose={() => setPresentingTraining(null)}
        />
      )}
    </div>
  );
}
