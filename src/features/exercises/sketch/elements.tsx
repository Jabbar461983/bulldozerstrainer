import type { SketchArrow, SketchArrowKind, SketchFreehandStroke, SketchMarker, SketchMarkerKind } from './types';

export const MARKER_RADIUS = 14;
const BALL_R = 5;
const CONE_SIZE = 11;
const GOAL_W = 34;
const GOAL_H = 22;

const OFFENSE_COLOR = '#0d8a4f';
const DEFENSE_COLOR = '#d81e28';
const BALL_COLOR = '#e08a2b';
const CONE_COLOR = '#c9971a';

export function SketchDefs() {
  return (
    <defs>
      <marker id="sketch-arrow-black" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
        <path d="M0,0 L9,4.5 L0,9 Z" fill="#111111" />
      </marker>
      <marker id="sketch-arrow-red" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
        <path d="M0,0 L9,4.5 L0,9 Z" fill="#c81e1e" />
      </marker>
    </defs>
  );
}

function SelectionRing({ x, y, r }: { x: number; y: number; r: number }) {
  return <circle cx={x} cy={y} r={r + 5} fill="none" stroke="#2563eb" strokeWidth={2} strokeDasharray="3 3" />;
}

export function MarkerShape({ marker, selected }: { marker: SketchMarker; selected?: boolean }) {
  const { kind, x, y, label } = marker;

  if (kind === 'ball') {
    const offsets: [number, number][] = [
      [0, -BALL_R * 0.9],
      [-BALL_R * 0.85, BALL_R * 0.5],
      [BALL_R * 0.85, BALL_R * 0.5],
    ];
    return (
      <g>
        {selected && <SelectionRing x={x} y={y} r={BALL_R * 1.6} />}
        {offsets.map(([dx, dy], i) => (
          <circle key={i} cx={x + dx} cy={y + dy} r={BALL_R} fill={BALL_COLOR} stroke="#8a5410" strokeWidth={0.8} />
        ))}
      </g>
    );
  }

  if (kind === 'cone') {
    const points = Array.from({ length: 8 }, (_, i) => {
      const angle = (Math.PI / 4) * i;
      const r = i % 2 === 0 ? CONE_SIZE : CONE_SIZE * 0.42;
      return `${x + Math.cos(angle) * r},${y + Math.sin(angle) * r}`;
    }).join(' ');
    return (
      <g>
        {selected && <SelectionRing x={x} y={y} r={CONE_SIZE} />}
        <polygon points={points} fill={CONE_COLOR} stroke="#8a6a10" strokeWidth={1} />
      </g>
    );
  }

  if (kind === 'goal') {
    return (
      <g>
        {selected && <SelectionRing x={x} y={y} r={GOAL_W / 2} />}
        <g transform={`translate(${x - GOAL_W / 2}, ${y - GOAL_H / 2})`}>
          <rect width={GOAL_W} height={GOAL_H} fill="none" stroke="#c9971a" strokeWidth={2} rx={2} />
          {Array.from({ length: 5 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={(GOAL_W / 4) * i}
              y1={0}
              x2={(GOAL_W / 4) * i}
              y2={GOAL_H}
              stroke="#c9971a"
              strokeWidth={0.6}
            />
          ))}
          {Array.from({ length: 4 }, (_, i) => (
            <line
              key={`h${i}`}
              x1={0}
              y1={(GOAL_H / 3) * i}
              x2={GOAL_W}
              y2={(GOAL_H / 3) * i}
              stroke="#c9971a"
              strokeWidth={0.6}
            />
          ))}
        </g>
      </g>
    );
  }

  const isOffense = kind === 'player_offense';
  return (
    <g>
      {selected && <SelectionRing x={x} y={y} r={MARKER_RADIUS} />}
      {isOffense ? (
        <circle cx={x} cy={y} r={MARKER_RADIUS} fill={OFFENSE_COLOR} />
      ) : (
        <polygon
          points={`${x},${y - MARKER_RADIUS * 1.1} ${x - MARKER_RADIUS * 1.05},${y + MARKER_RADIUS * 0.85} ${x + MARKER_RADIUS * 1.05},${y + MARKER_RADIUS * 0.85}`}
          fill={DEFENSE_COLOR}
        />
      )}
      {label && (
        <text
          x={x}
          y={y + (isOffense ? 4 : 6)}
          textAnchor="middle"
          fontSize={13}
          fontWeight={700}
          fill="#ffffff"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {label}
        </text>
      )}
    </g>
  );
}

function arrowStyle(kind: SketchArrowKind): { stroke: string; dash?: string; markerId: string } {
  switch (kind) {
    case 'path_with_ball':
      return { stroke: '#111111', markerId: 'sketch-arrow-black' };
    case 'path_without_ball':
      return { stroke: '#111111', dash: '6 5', markerId: 'sketch-arrow-black' };
    case 'pass':
      return { stroke: '#c81e1e', markerId: 'sketch-arrow-red' };
    case 'shot':
      return { stroke: '#c81e1e', dash: '6 5', markerId: 'sketch-arrow-red' };
  }
}

export function ArrowShape({ arrow, selected }: { arrow: SketchArrow; selected?: boolean }) {
  const style = arrowStyle(arrow.kind);
  const pointsAttr = arrow.points.map((p) => `${p.x},${p.y}`).join(' ');
  return (
    <g>
      {selected && (
        <polyline points={pointsAttr} fill="none" stroke="#2563eb" strokeWidth={7} strokeLinecap="round" opacity={0.35} />
      )}
      <polyline
        points={pointsAttr}
        fill="none"
        stroke={style.stroke}
        strokeWidth={2.4}
        strokeDasharray={style.dash}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={`url(#${style.markerId})`}
      />
    </g>
  );
}

export function FreehandShape({ stroke, selected }: { stroke: SketchFreehandStroke; selected?: boolean }) {
  const pointsAttr = stroke.points.map((p) => `${p.x},${p.y}`).join(' ');
  return (
    <g>
      {selected && (
        <polyline points={pointsAttr} fill="none" stroke="#2563eb" strokeWidth={8} strokeLinecap="round" opacity={0.35} />
      )}
      <polyline
        points={pointsAttr}
        fill="none"
        stroke={stroke.color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

export const MARKER_LABELS: Record<SketchMarkerKind, string> = {
  ball: 'Bälle',
  cone: 'Hütchen',
  player_offense: 'Offensiv',
  player_defense: 'Defensiv',
  goal: 'Tor',
};

export const ARROW_LABELS: Record<SketchArrowKind, string> = {
  path_with_ball: 'Laufweg mit Ball',
  path_without_ball: 'Laufweg ohne Ball',
  pass: 'Pass',
  shot: 'Schuss',
};
