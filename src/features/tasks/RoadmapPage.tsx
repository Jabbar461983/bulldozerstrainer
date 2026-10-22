import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { BackLinkButton, Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Select } from '../../components/Select';
import { fetchAllTasks, fetchRessortMembers, fetchRessorts, isOverdue } from './api';
import type { TaskRow } from './api';
import type { VorstandRessort } from '../../types/database';
import { TaskDetailDialog } from './TaskDetailDialog';

// Roadmap Vorstand: Matrix Ressorts (Zeilen) x Zeitstrahl (Monate), analog
// Saisonplanung. Jede Vorstands-Aufgabe erscheint als Punkt am Fälligkeitsdatum
// in jedem Ressort der Empfängerin/des Empfängers. Eine Aufgabe an mehrere
// Personen desselben Ressorts erscheint dort nur einmal.

type MarkerStatus = 'offen' | 'erledigt' | 'ueberfaellig';

interface RoadmapMarker {
  key: string;
  date: string;
  title: string;
  description: string | null;
  assignees: string[];
  status: MarkerStatus;
  task: TaskRow;
  lane: number;
}

interface RoadmapRow {
  key: string;
  label: string;
  markers: RoadmapMarker[];
  lanes: number;
}

const RANGE_OPTIONS = [3, 6, 12] as const;
/** Automatischer Zeitraum: bis heute + so viele Monate. */
const AUTO_MONTHS_AHEAD = 6;
const NO_RESSORT = '__none__';
const STATUS_LABELS: Record<MarkerStatus, string> = { offen: 'Offen', erledigt: 'Erledigt', ueberfaellig: 'Überfällig' };
const STATUS_DOT: Record<MarkerStatus, string> = {
  offen: 'bg-gold border-gold-text',
  erledigt: 'bg-success border-success',
  ueberfaellig: 'bg-danger border-danger',
};

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function markerStatus(tasks: TaskRow[]): MarkerStatus {
  if (tasks.every((t) => t.completed)) return 'erledigt';
  return isOverdue(tasks[0].due_date) ? 'ueberfaellig' : 'offen';
}

export function RoadmapPage() {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [ressorts, setRessorts] = useState<VorstandRessort[]>([]);
  const [members, setMembers] = useState<{ ressortId: string | null; userId: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  // null = automatischer Zeitraum (siehe autoRange), sonst manuell gewählt/verschoben.
  const [manualRange, setManualRange] = useState<{ start: Date; months: number } | null>(null);
  const [visibleRessorts, setVisibleRessorts] = useState<Set<string> | null>(null); // null = alle
  const [hovered, setHovered] = useState<{ marker: RoadmapMarker; rect: DOMRect } | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const [allTasks, ressortRows, memberRows] = await Promise.all([
          fetchAllTasks(),
          fetchRessorts(),
          fetchRessortMembers(),
        ]);
        setTasks(allTasks.filter((t) => t.category === 'vorstand'));
        setRessorts(ressortRows);
        setMembers(memberRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Roadmap konnte nicht geladen werden.');
      }
    }
    void load();
  }, [reloadKey]);

  // Automatisch: ab der am längsten fälligen, noch nicht erledigten Vorstands-Aufgabe
  // (offen oder in Arbeit) bis heute + 6 Monate. Ältere Pendenzen bleiben so sichtbar.
  const autoRange = useMemo(() => {
    const thisMonth = startOfMonth(new Date());
    const oldestOpen = (tasks ?? [])
      .filter((t) => !t.completed)
      .reduce<string | null>((min, t) => (min === null || t.due_date < min ? t.due_date : min), null);
    const start = oldestOpen ? startOfMonth(new Date(`${oldestOpen}T00:00:00`)) : thisMonth;
    const from = start < thisMonth ? start : thisMonth;
    const months =
      (thisMonth.getFullYear() - from.getFullYear()) * 12 + (thisMonth.getMonth() - from.getMonth()) + AUTO_MONTHS_AHEAD + 1;
    return { start: from, months };
  }, [tasks]);

  const rangeStart = manualRange?.start ?? autoRange.start;
  const rangeMonths = manualRange?.months ?? autoRange.months;
  const rangeEnd = useMemo(() => addMonths(rangeStart, rangeMonths), [rangeStart, rangeMonths]);
  const totalDays = Math.max(1, dayDiff(rangeStart, rangeEnd));

  const months = useMemo(
    () =>
      Array.from({ length: rangeMonths }, (_, i) => {
        const start = addMonths(rangeStart, i);
        const end = addMonths(rangeStart, i + 1);
        return {
          key: `${start.getFullYear()}-${start.getMonth()}`,
          label: start.toLocaleDateString('de-CH', { month: rangeMonths > 6 ? 'short' : 'long' }).replace('.', ''),
          compact: rangeMonths > 12,
          year: start.getFullYear(),
          // Jahr nur beim Jahreswechsel (der Zeitraum oben nennt es ohnehin).
          showYear: i > 0 && start.getMonth() === 0,
          left: (dayDiff(rangeStart, start) / totalDays) * 100,
          width: (dayDiff(start, end) / totalDays) * 100,
        };
      }),
    [rangeStart, rangeMonths, totalDays],
  );

  const todayPercent = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const p = (dayDiff(rangeStart, today) / totalDays) * 100;
    return p >= 0 && p <= 100 ? p : null;
  }, [rangeStart, totalDays]);

  const allRows = useMemo<RoadmapRow[]>(() => {
    if (!tasks) return [];
    const groups: { key: string; label: string; memberIds: Set<string> }[] = ressorts.map((r) => ({
      key: r.id,
      label: r.name,
      memberIds: new Set(members.filter((m) => m.ressortId === r.id).map((m) => m.userId)),
    }));
    const without = new Set(members.filter((m) => m.ressortId === null).map((m) => m.userId));
    if (without.size > 0) groups.push({ key: NO_RESSORT, label: 'Ohne Ressort', memberIds: without });

    const minGapDays = totalDays * 0.03; // Punkte, die näher liegen, kommen in eine eigene Spur
    return groups.map((g) => {
      const byGroup = new Map<string, TaskRow[]>();
      for (const t of tasks) {
        if (!g.memberIds.has(t.assigned_to)) continue;
        if (t.due_date < toIso(rangeStart) || t.due_date >= toIso(rangeEnd)) continue;
        const list = byGroup.get(t.task_group_id) ?? [];
        list.push(t);
        byGroup.set(t.task_group_id, list);
      }
      const sorted = Array.from(byGroup.entries())
        .map(([groupId, groupTasks]) => ({
          key: `${g.key}:${groupId}`,
          date: groupTasks[0].due_date,
          title: groupTasks[0].title,
          description: groupTasks[0].description,
          assignees: groupTasks.map((t) => t.assigneeName),
          status: markerStatus(groupTasks),
          task: groupTasks[0],
          lane: 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      const laneLastDay: number[] = [];
      for (const m of sorted) {
        const day = dayDiff(rangeStart, new Date(`${m.date}T00:00:00`));
        let lane = laneLastDay.findIndex((last) => day - last >= minGapDays);
        if (lane === -1) {
          lane = laneLastDay.length;
          laneLastDay.push(day);
        } else {
          laneLastDay[lane] = day;
        }
        m.lane = lane;
      }
      return { key: g.key, label: g.label, markers: sorted, lanes: Math.max(1, laneLastDay.length) };
    });
  }, [tasks, ressorts, members, rangeStart, rangeEnd, totalDays]);

  const rows = allRows.filter((r) => visibleRessorts === null || visibleRessorts.has(r.key));

  function toggleRessort(key: string) {
    setVisibleRessorts((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next.size === 0 ? null : next;
    });
  }

  function shift(monthsDelta: number) {
    setManualRange({ start: addMonths(rangeStart, monthsDelta), months: rangeMonths });
  }

  const rangeLabel = `${rangeStart.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' })} – ${addMonths(
    rangeEnd,
    -1,
  ).toLocaleDateString('de-CH', { month: 'long', year: 'numeric' })}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-text">Roadmap Vorstand</h1>
        <BackLinkButton to="/aufgaben">Zurück zu Aufgaben</BackLinkButton>
      </div>

      {/* Zeitraum */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => shift(-1)} aria-label="Einen Monat zurück">
          ‹
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setManualRange(null)} disabled={manualRange === null}>
          Standard
        </Button>
        <Button variant="secondary" size="sm" onClick={() => shift(1)} aria-label="Einen Monat vor">
          ›
        </Button>
        <span className="px-1 text-sm font-semibold text-text">{rangeLabel}</span>
        <div className="ml-auto w-56">
          <Select
            aria-label="Zeitraum"
            value={manualRange === null ? 'auto' : String(manualRange.months)}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'auto') setManualRange(null);
              else setManualRange({ start: addMonths(startOfMonth(new Date()), -1), months: Number(value) });
            }}
            className="min-h-9 py-1 text-sm"
          >
            <option value="auto">Automatisch ({autoRange.months} Monate)</option>
            {RANGE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} Monate
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Ressort-Auswahl */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ressorts anzeigen">
        <button
          type="button"
          onClick={() => setVisibleRessorts(null)}
          aria-pressed={visibleRessorts === null}
          className={clsx(
            'rounded border px-2.5 py-1 text-xs font-semibold transition-colors',
            visibleRessorts === null
              ? 'border-gold bg-gold/15 text-gold-text'
              : 'border-border-strong bg-surface text-text-muted hover:text-text',
          )}
        >
          Alle Ressorts
        </button>
        {allRows.map((r) => {
          const active = visibleRessorts?.has(r.key) ?? false;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => toggleRessort(r.key)}
              aria-pressed={active}
              className={clsx(
                'rounded border px-2.5 py-1 text-xs font-semibold transition-colors',
                active
                  ? 'border-gold bg-gold/15 text-gold-text'
                  : 'border-border-strong bg-surface text-text-muted hover:text-text',
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Legende */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
        {(Object.keys(STATUS_LABELS) as MarkerStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={clsx('size-3 rounded-full border', STATUS_DOT[s])} />
            {STATUS_LABELS[s]}
          </span>
        ))}
        {todayPercent !== null && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-accent" />
            Heute
          </span>
        )}
      </div>

      {error && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {tasks === null && !error && <p className="text-sm text-text-muted">Lädt…</p>}
      {tasks !== null && allRows.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Es sind noch keine Ressorts angelegt.</p>
        </Card>
      )}

      {tasks !== null && rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          {/* Bei langen Zeiträumen werden die Monate schmaler, statt dass die Grafik endlos breit wird. */}
          <div style={{ minWidth: Math.max(640, 128 + rangeMonths * (rangeMonths > 12 ? 40 : 90)) }}>
            {/* Monatskopf */}
            <div className="flex border-b border-border bg-surface-alt">
              <div className="sticky left-0 z-10 w-32 shrink-0 border-r border-border bg-surface-alt px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Ressort
              </div>
              <div className="relative h-9 flex-1">
                {months.map((m) => (
                  <div
                    key={m.key}
                    className={clsx(
                      'absolute top-0 bottom-0 flex items-center justify-center border-r border-border px-0.5 font-semibold text-text',
                      m.compact ? 'text-[10px]' : 'text-xs',
                    )}
                    style={{ left: `${m.left}%`, width: `${m.width}%` }}
                  >
                    <span className="truncate">
                      {m.label}
                      {m.showYear && (
                        <span className="ml-0.5 font-normal text-text-muted">
                          {m.compact ? `'${String(m.year).slice(2)}` : m.year}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ressort-Zeilen */}
            {rows.map((row) => (
              <div key={row.key} className="flex border-b border-border last:border-b-0">
                <div className="sticky left-0 z-10 flex w-32 shrink-0 items-center border-r border-border bg-surface px-3 py-2 text-sm font-semibold text-text">
                  <span className="truncate">{row.label}</span>
                </div>
                <div className="relative flex-1" style={{ height: `${Math.max(44, row.lanes * 22 + 20)}px` }}>
                  {months.map((m) => (
                    <div
                      key={m.key}
                      className="absolute top-0 bottom-0 border-r border-border/70"
                      style={{ left: `${m.left + m.width}%` }}
                    />
                  ))}
                  {todayPercent !== null && (
                    <div className="absolute top-0 bottom-0 w-0.5 bg-accent/60" style={{ left: `${todayPercent}%` }} />
                  )}
                  {row.markers.map((m) => {
                    const left = (dayDiff(rangeStart, new Date(`${m.date}T00:00:00`)) / totalDays) * 100;
                    const show = (el: HTMLElement) => setHovered({ marker: m, rect: el.getBoundingClientRect() });
                    return (
                      <div key={m.key} className="absolute" style={{ left: `${left}%`, top: `${10 + m.lane * 22}px` }}>
                        <button
                          type="button"
                          aria-label={`${m.title}, fällig ${formatDate(m.date)}, ${STATUS_LABELS[m.status]}`}
                          onMouseEnter={(e) => show(e.currentTarget)}
                          onMouseLeave={() => setHovered(null)}
                          onFocus={(e) => show(e.currentTarget)}
                          onBlur={() => setHovered(null)}
                          onClick={() => {
                            setHovered(null);
                            setSelectedTask(m.task);
                          }}
                          className={clsx(
                            'block size-3.5 -translate-x-1/2 rounded-full border-2 transition-transform hover:scale-125',
                            STATUS_DOT[m.status],
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks !== null && rows.length > 0 && rows.every((r) => r.markers.length === 0) && (
        <p className="text-sm text-text-muted">Im gewählten Zeitraum sind keine Vorstands-Aufgaben fällig.</p>
      )}

      {hovered && <RoadmapTooltip marker={hovered.marker} rect={hovered.rect} />}

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onChanged={() => {
            setSelectedTask(null);
            setReloadKey((k) => k + 1);
          }}
          onDeleted={() => {
            setSelectedTask(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const TOOLTIP_WIDTH = 256;

/** Tooltip über dem Punkt, an der Seite fixiert (wird vom scrollbaren Zeitstrahl nicht abgeschnitten). */
function RoadmapTooltip({ marker, rect }: { marker: RoadmapMarker; rect: DOMRect }) {
  const left = Math.min(
    Math.max(8, rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2),
    window.innerWidth - TOOLTIP_WIDTH - 8,
  );
  const above = rect.top > 160;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-md border border-border bg-surface p-3 text-left shadow-xl"
      style={{
        width: TOOLTIP_WIDTH,
        left,
        top: above ? rect.top - 8 : rect.bottom + 8,
        transform: above ? 'translateY(-100%)' : undefined,
      }}
    >
      <p className="text-sm font-semibold text-text">{marker.title}</p>
      {marker.description && (
        <p className="mt-1 line-clamp-4 whitespace-pre-line text-xs text-text-muted">{marker.description}</p>
      )}
      <p className="mt-2 text-[11px] text-text-muted">
        Fällig {formatDate(marker.date)} · {STATUS_LABELS[marker.status]}
      </p>
      <p className="text-[11px] text-text-muted">{marker.assignees.join(', ')}</p>
    </div>
  );
}
