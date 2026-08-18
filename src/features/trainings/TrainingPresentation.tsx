import { useEffect, useMemo, useState } from 'react';
import type { TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Button } from '../../components/Button';
import { fetchTrainingExercises, fetchTrainingAbsences } from './api';
import type { TrainingExerciseRow } from './api';
import { fetchTeamPlayerRoster } from '../../lib/roster';
import { fetchGames } from '../games/api';
import { todayIso, addMinutesToTime } from '../../lib/dates';
import { ExerciseMediaCarousel } from './ExerciseMediaCarousel';
import type { Game, Training } from '../../types/database';

interface TrainingPresentationProps {
  training: Training;
  teamId: string;
  trainings: Training[];
  onClose: () => void;
}

interface ProgramItem {
  title: string;
  durationMinutes: number;
  startClock: string | null;
  endClock: string | null;
}

type Page =
  | { type: 'overview' }
  | { type: 'program'; items: ProgramItem[] }
  | { type: 'exercise'; exercise: TrainingExerciseRow; startClock: string | null; endClock: string | null }
  | { type: 'closing' };

interface UpcomingItem {
  date: string;
  time: string | null;
  label: string;
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('de-CH', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatShortDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('de-CH', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

export function TrainingPresentation({ training, teamId, trainings, onClose }: TrainingPresentationProps) {
  const [exercises, setExercises] = useState<TrainingExerciseRow[] | null>(null);
  const [absentPlayerNames, setAbsentPlayerNames] = useState<string[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [exerciseRows, absences, players, games] = await Promise.all([
          fetchTrainingExercises(training.id),
          fetchTrainingAbsences(training.id),
          fetchTeamPlayerRoster(teamId),
          fetchGames(teamId),
        ]);
        if (cancelled) return;
        setExercises(exerciseRows);
        const nameById = new Map(players.map((p) => [p.playerId, `${p.firstName} ${p.lastName}`]));
        setAbsentPlayerNames(
          absences
            .filter((a) => a.person_type === 'player' && a.player_id)
            .map((a) => nameById.get(a.player_id as string) ?? 'Unbekannt'),
        );
        setUpcomingGames(games.filter((g) => g.date >= todayIso()));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Training konnte nicht geladen werden.');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [training.id, teamId]);

  const pages = useMemo<Page[]>(() => {
    const programItems: ProgramItem[] = [];
    const exercisePages: Page[] = [];
    let cursor = training.start_time;
    for (const exercise of exercises ?? []) {
      const startClock = cursor;
      const endClock = cursor ? addMinutesToTime(cursor, exercise.duration_minutes) : null;
      programItems.push({ title: exercise.exerciseTitle, durationMinutes: exercise.duration_minutes, startClock, endClock });
      exercisePages.push({ type: 'exercise', exercise, startClock, endClock });
      cursor = endClock;
    }
    return [{ type: 'overview' }, { type: 'program', items: programItems }, ...exercisePages, { type: 'closing' }];
  }, [exercises, training.start_time]);

  const upcomingItems = useMemo<UpcomingItem[]>(() => {
    const today = todayIso();
    const trainingItems: UpcomingItem[] = trainings
      .filter((t) => t.date >= today && t.id !== training.id)
      .map((t) => ({ date: t.date, time: t.start_time, label: 'Training' }));
    const gameItems: UpcomingItem[] = upcomingGames.map((g) => ({
      date: g.date,
      time: g.time,
      label: `Spiel: ${g.home_team} – ${g.away_team}`,
    }));
    return [...trainingItems, ...gameItems]
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
      .slice(0, 5);
  }, [trainings, upcomingGames, training.id]);

  function goTo(index: number) {
    setPageIndex(Math.max(0, Math.min(pages.length - 1, index)));
  }

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(deltaX) > 50) {
      goTo(deltaX < 0 ? pageIndex + 1 : pageIndex - 1);
    }
    setTouchStartX(null);
  }

  const page = pages[pageIndex];

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex flex-wrap gap-1">
          {pages.map((_, i) => (
            <span
              key={i}
              className={clsx('size-1.5 rounded-full', i === pageIndex ? 'bg-accent' : 'bg-border')}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Abspielmodus schliessen"
          className="flex size-9 items-center justify-center rounded-lg text-text-muted hover:bg-surface-alt"
        >
          ✕
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto px-5 py-6"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {error && <p className="text-sm text-danger">{error}</p>}
        {!exercises && !error && <p className="text-sm text-text-muted">Lädt…</p>}

        {exercises && page.type === 'overview' && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-2xl font-semibold text-text">{formatDay(training.date)}</h1>
              {training.start_time && (
                <p className="mt-1 text-lg text-text-muted">Start: {training.start_time.slice(0, 5)} Uhr</p>
              )}
            </div>
            <div>
              <h2 className="mb-2 text-sm font-semibold text-text-muted">Abgemeldete Spieler</h2>
              {absentPlayerNames.length === 0 ? (
                <p className="text-sm text-text-muted">Niemand abgemeldet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {absentPlayerNames.map((name, i) => (
                    <li key={i} className="text-sm text-text">
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {training.notes && (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-text-muted">Notizen</h2>
                <p className="whitespace-pre-wrap text-sm text-text">{training.notes}</p>
              </div>
            )}
          </div>
        )}

        {exercises && page.type === 'program' && (
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-semibold text-text">Programm</h1>
            {page.items.length === 0 ? (
              <p className="text-sm text-text-muted">Noch keine Übungen eingeplant.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {page.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm"
                  >
                    <span className="font-medium text-text">{item.title}</span>
                    <span className="shrink-0 text-right text-text-muted">
                      {item.durationMinutes} Min.
                      {item.startClock && item.endClock && (
                        <>
                          <br />
                          {item.startClock.slice(0, 5)}–{item.endClock.slice(0, 5)}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {exercises && page.type === 'exercise' && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-text">{page.exercise.exerciseTitle}</h1>
              <p className="mt-1 text-lg text-text-muted">
                {page.exercise.duration_minutes} Min.
                {page.startClock && page.endClock && ` · ${page.startClock.slice(0, 5)}–${page.endClock.slice(0, 5)}`}
              </p>
            </div>
            {page.exercise.media.length > 0 && <ExerciseMediaCarousel media={page.exercise.media} autoPlay />}
            {page.exercise.exerciseDescription && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-text-muted">Beschreibung</h2>
                <p className="whitespace-pre-wrap text-sm text-text">{page.exercise.exerciseDescription}</p>
              </div>
            )}
            {page.exercise.exerciseVariants && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-text-muted">Varianten</h2>
                <p className="whitespace-pre-wrap text-sm text-text">{page.exercise.exerciseVariants}</p>
              </div>
            )}
            {page.exercise.exerciseCoachingQuestions && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-text-muted">Coachingfragen</h2>
                <p className="whitespace-pre-wrap text-sm text-text">{page.exercise.exerciseCoachingQuestions}</p>
              </div>
            )}
          </div>
        )}

        {exercises && page.type === 'closing' && (
          <div className="flex flex-col gap-5">
            {training.information && (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-text-muted">Informationen</h2>
                <p className="whitespace-pre-wrap text-sm text-text">{training.information}</p>
              </div>
            )}
            <div>
              <h2 className="mb-2 text-sm font-semibold text-text-muted">Nächste Termine</h2>
              {upcomingItems.length === 0 ? (
                <p className="text-sm text-text-muted">Keine weiteren Termine geplant.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {upcomingItems.map((item, i) => (
                    <li key={i} className="rounded-xl border border-border p-3 text-sm">
                      <p className="font-medium text-text">{item.label}</p>
                      <p className="text-text-muted">
                        {formatShortDay(item.date)}
                        {item.time && ` · ${item.time.slice(0, 5)}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 pb-[env(safe-area-inset-bottom)]">
        <Button type="button" variant="secondary" disabled={pageIndex === 0} onClick={() => goTo(pageIndex - 1)}>
          ‹ Zurück
        </Button>
        <span className="text-xs text-text-muted">
          {pageIndex + 1} / {pages.length}
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={pageIndex === pages.length - 1}
          onClick={() => goTo(pageIndex + 1)}
        >
          Weiter ›
        </Button>
      </div>
    </div>,
    document.body,
  );
}
