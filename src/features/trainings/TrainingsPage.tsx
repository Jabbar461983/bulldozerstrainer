import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
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

const SECTION_STORAGE_KEY = 'trainings-open-sections';

function readOpenSections(): { upcoming: boolean; past: boolean } {
  try {
    const raw = localStorage.getItem(SECTION_STORAGE_KEY);
    if (raw) return { upcoming: false, past: false, ...JSON.parse(raw) };
  } catch {
    // ignorieren - Standard verwenden
  }
  return { upcoming: false, past: false };
}

function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-left hover:bg-surface-alt"
      >
        <span className="font-semibold text-text">
          {title} <span className="font-normal text-text-muted">({count})</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`size-5 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && children}
    </div>
  );
}

export function TrainingsPage() {
  const [openSections, setOpenSections] = useState(readOpenSections);

  function toggleSection(section: 'upcoming' | 'past') {
    setOpenSections((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      try {
        localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignorieren
      }
      return next;
    });
  }

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
    const past = (trainings ?? [])
      .filter((t) => t.date < today)
      .sort((a, b) => b.date.localeCompare(a.date));
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
                <span className="rounded bg-accent/10 px-2.5 py-1 text-xs text-accent">
                  {training.field_type === 'off_field' ? 'Off Field' : 'On Field'}
                </span>
              </div>
            </div>
            {(info?.ratingByName || (info && info.plannedMinutes > 0)) && (
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-text-muted">
                <span>{info?.ratingByName && `Bewertet von ${info.ratingByName}`}</span>
                {info && info.plannedMinutes > 0 && (
                  <span className="shrink-0">{seasonCoverage[training.id] ?? 0}% gemäss Saisonplanung</span>
                )}
              </div>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-text">Training</h1>
        <div className="flex flex-wrap items-center gap-2">
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
        <div className="flex flex-col gap-3">
          <CollapsibleSection
            title="Kommende Trainings"
            count={upcoming.length}
            open={openSections.upcoming}
            onToggle={() => toggleSection('upcoming')}
          >
            {upcoming.length === 0 ? (
              <Card>
                <p className="text-sm text-text-muted">Keine kommenden Trainings geplant.</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">{upcoming.map(renderTraining)}</div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Vergangene Trainings"
            count={past.length}
            open={openSections.past}
            onToggle={() => toggleSection('past')}
          >
            {past.length === 0 ? (
              <Card>
                <p className="text-sm text-text-muted">Noch keine vergangenen Trainings.</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">{past.map(renderTraining)}</div>
            )}
          </CollapsibleSection>
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
