import type {
  SketchArrow,
  SketchArrowKind,
  SketchComment,
  SketchFreehandStroke,
  SketchMarker,
  SketchMarkerKind,
} from './types';

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
  return (
    <circle
      cx={x}
      cy={y}
      r={r + 5}
      fill="none"
      stroke="#2563eb"
      strokeWidth={2}
      strokeDasharray="3 3"
      data-sketch-ui="true"
    />
  );
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
  const color = isOffense ? OFFENSE_COLOR : DEFENSE_COLOR;
  return (
    <g>
      {selected && <SelectionRing x={x} y={y} r={MARKER_RADIUS} />}
      <g stroke={color} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx={x} cy={y - 9} r={3.4} fill={color} stroke="none" />
        <line x1={x} y1={y - 5.6} x2={x} y2={y + 3} />
        <line x1={x} y1={y - 3} x2={x - 6} y2={y + 2} />
        <line x1={x} y1={y - 3} x2={x + 6} y2={y + 2} />
        <line x1={x} y1={y + 3} x2={x - 5} y2={y + 11} />
        <line x1={x} y1={y + 3} x2={x + 5} y2={y + 11} />
      </g>
      {label && (
        <text
          x={x}
          y={y + 21}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fill={color}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {label}
        </text>
      )}
    </g>
  );
}

export function arrowStyle(kind: SketchArrowKind): { stroke: string; dash?: string; markerId: string } {
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

export function getArrowControlPoint(arrow: SketchArrow): { x: number; y: number } {
  if (arrow.control) return arrow.control;
  const [p0, p1 = p0] = arrow.points;
  return { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
}

function arrowPathD(arrow: SketchArrow): string {
  const [p0, p1 = p0] = arrow.points;
  if (!p0) return '';
  if (arrow.control) {
    return `M ${p0.x},${p0.y} Q ${arrow.control.x},${arrow.control.y} ${p1.x},${p1.y}`;
  }
  return `M ${p0.x},${p0.y} L ${p1.x},${p1.y}`;
}

export function ArrowShape({ arrow, selected }: { arrow: SketchArrow; selected?: boolean }) {
  const style = arrowStyle(arrow.kind);
  const d = arrowPathD(arrow);
  return (
    <g>
      {selected && (
        <path d={d} fill="none" stroke="#2563eb" strokeWidth={7} strokeLinecap="round" opacity={0.35} data-sketch-ui="true" />
      )}
      <path
        d={d}
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
        <polyline
          points={pointsAttr}
          fill="none"
          stroke="#2563eb"
          strokeWidth={8}
          strokeLinecap="round"
          opacity={0.35}
          data-sketch-ui="true"
        />
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

const COMMENT_BG = '#fef3c7';
const COMMENT_BORDER = '#c9971a';

export function CommentShape({ comment, selected }: { comment: SketchComment; selected?: boolean }) {
  const { x, y, text } = comment;
  const display = text.trim().length > 0 ? text : '…';
  const width = Math.min(220, Math.max(36, display.length * 6.2 + 20));
  const height = 26;
  const bubbleX = x - width / 2;
  const bubbleY = y - height - 10;

  return (
    <g>
      {selected && (
        <rect
          x={bubbleX - 4}
          y={bubbleY - 4}
          width={width + 8}
          height={height + 8}
          rx={10}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2}
          strokeDasharray="3 3"
          data-sketch-ui="true"
        />
      )}
      <line x1={x} y1={y} x2={x} y2={bubbleY + height} stroke={COMMENT_BORDER} strokeWidth={1.4} />
      <rect x={bubbleX} y={bubbleY} width={width} height={height} rx={6} fill={COMMENT_BG} stroke={COMMENT_BORDER} strokeWidth={1.4} />
      <text
        x={x}
        y={bubbleY + height / 2 + 4}
        textAnchor="middle"
        fontSize={11}
        fill="#5a4308"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {display}
      </text>
      <circle cx={x} cy={y} r={2.5} fill={COMMENT_BORDER} />
    </g>
  );
}

function MiniFieldIcon({ children, viewBox = '-20 -20 40 40', width = 22, height = 22 }: {
  children: React.ReactNode;
  viewBox?: string;
  width?: number;
  height?: number;
}) {
  return (
    <svg viewBox={viewBox} width={width} height={height} aria-hidden="true">
      {children}
    </svg>
  );
}

export function MarkerToolIcon({ kind }: { kind: SketchMarkerKind }) {
  const label = kind === 'player_offense' ? 'A' : kind === 'player_defense' ? 'B' : undefined;
  return (
    <MiniFieldIcon>
      <MarkerShape marker={{ id: 'icon', kind, x: 0, y: 0, label }} />
    </MiniFieldIcon>
  );
}

export function ArrowToolIcon({ kind }: { kind: SketchArrowKind }) {
  const style = arrowStyle(kind);
  return (
    <MiniFieldIcon viewBox="-18 -9 36 18" width={28} height={14}>
      <line
        x1={-14}
        y1={0}
        x2={9}
        y2={0}
        stroke={style.stroke}
        strokeWidth={2.4}
        strokeDasharray={style.dash}
        strokeLinecap="round"
      />
      <path d="M7,-4.5 L15,0 L7,4.5 Z" fill={style.stroke} />
    </MiniFieldIcon>
  );
}

export function UtilityToolIcon({ tool }: { tool: 'select' | 'pen' | 'eraser' | 'comment' }) {
  if (tool === 'select') {
    return (
      <MiniFieldIcon viewBox="0 0 20 20" width={18} height={18}>
        <path d="M3,2 L3,17 L7,13.5 L9.5,18 L12,16.7 L9.5,12.2 L15,12.2 Z" fill="#374151" />
      </MiniFieldIcon>
    );
  }
  if (tool === 'pen') {
    return (
      <MiniFieldIcon viewBox="0 0 20 20" width={18} height={18}>
        <path d="M3,17 L4,13 L13,4 L16,7 L7,16 Z" fill="none" stroke="#374151" strokeWidth={1.6} strokeLinejoin="round" />
        <line x1={11.5} y1={5.5} x2={14.5} y2={8.5} stroke="#374151" strokeWidth={1.6} />
      </MiniFieldIcon>
    );
  }
  if (tool === 'eraser') {
    return (
      <MiniFieldIcon viewBox="0 0 20 20" width={18} height={18}>
        <rect x={3} y={9} width={14} height={7} rx={1.5} fill="#f3d1d1" stroke="#a33333" strokeWidth={1.2} transform="rotate(-20 10 12)" />
      </MiniFieldIcon>
    );
  }
  return (
    <MiniFieldIcon viewBox="0 0 20 20" width={18} height={18}>
      <rect x={2} y={3} width={16} height={10} rx={3} fill={COMMENT_BG} stroke={COMMENT_BORDER} strokeWidth={1.4} />
      <path d="M6,13 L6,17 L10,13 Z" fill={COMMENT_BG} stroke={COMMENT_BORDER} strokeWidth={1.4} />
    </MiniFieldIcon>
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
