import type { ReactNode } from 'react';
import type { SketchFieldType } from './types';
import {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  FIELD_CORNER,
  BLUE_LINE_1_X,
  BLUE_LINE_2_X,
  CENTER_CIRCLE_R,
  FACEOFF_DOT_DX,
  FACEOFF_DOT_DY,
  FACEOFF_CIRCLE_R,
  GOAL_LINE_OFFSET,
  CREASE_W,
  CREASE_H,
  fieldViewBox,
} from './geometry';

const BLUE = '#1e3fb4';
const RED = '#c81e1e';
const BOARDS = '#141414';

interface RinkFieldProps {
  fieldType: SketchFieldType;
  className?: string;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  children?: ReactNode;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
}

export function RinkField({
  fieldType,
  className,
  svgRef,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: RinkFieldProps) {
  const centerY = FIELD_HEIGHT / 2;
  const faceoffPositions: [number, number][] = [
    [FACEOFF_DOT_DX, centerY - FACEOFF_DOT_DY],
    [FACEOFF_DOT_DX, centerY + FACEOFF_DOT_DY],
    [FIELD_WIDTH - FACEOFF_DOT_DX, centerY - FACEOFF_DOT_DY],
    [FIELD_WIDTH - FACEOFF_DOT_DX, centerY + FACEOFF_DOT_DY],
  ];

  return (
    <svg
      ref={svgRef}
      viewBox={fieldViewBox(fieldType)}
      className={className}
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <rect x={0} y={0} width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="#ffffff" />

      <defs>
        <clipPath id="rink-boundary-clip">
          <rect x={0} y={0} width={FIELD_WIDTH} height={FIELD_HEIGHT} rx={FIELD_CORNER} ry={FIELD_CORNER} />
        </clipPath>
      </defs>

      <g clipPath="url(#rink-boundary-clip)">
        <line x1={FIELD_WIDTH / 2} y1={0} x2={FIELD_WIDTH / 2} y2={FIELD_HEIGHT} stroke={RED} strokeWidth={3} />

        <line x1={BLUE_LINE_1_X} y1={0} x2={BLUE_LINE_1_X} y2={FIELD_HEIGHT} stroke={BLUE} strokeWidth={4} />
        <line x1={BLUE_LINE_2_X} y1={0} x2={BLUE_LINE_2_X} y2={FIELD_HEIGHT} stroke={BLUE} strokeWidth={4} />

        <circle cx={FIELD_WIDTH / 2} cy={centerY} r={CENTER_CIRCLE_R} fill="none" stroke={BLUE} strokeWidth={2.2} />
        <circle cx={FIELD_WIDTH / 2} cy={centerY} r={3} fill={RED} />

        {faceoffPositions.map(([px, py], i) => (
          <g key={i}>
            <circle cx={px} cy={py} r={FACEOFF_CIRCLE_R} fill="none" stroke={RED} strokeWidth={2} />
            <circle cx={px} cy={py} r={2.6} fill={RED} />
          </g>
        ))}

        {/* Torlinien: bis zur Bande gezogen, durch den Clip-Path an der Rundung gekappt */}
        <line x1={GOAL_LINE_OFFSET} y1={0} x2={GOAL_LINE_OFFSET} y2={FIELD_HEIGHT} stroke={RED} strokeWidth={2.4} />
        <line
          x1={FIELD_WIDTH - GOAL_LINE_OFFSET}
          y1={0}
          x2={FIELD_WIDTH - GOAL_LINE_OFFSET}
          y2={FIELD_HEIGHT}
          stroke={RED}
          strokeWidth={2.4}
        />

        <rect
          x={GOAL_LINE_OFFSET}
          y={centerY - CREASE_H / 2}
          width={CREASE_W}
          height={CREASE_H}
          rx={CREASE_H * 0.4}
          ry={CREASE_H * 0.4}
          fill="none"
          stroke={BLUE}
          strokeWidth={1.8}
        />
        <rect
          x={FIELD_WIDTH - GOAL_LINE_OFFSET - CREASE_W}
          y={centerY - CREASE_H / 2}
          width={CREASE_W}
          height={CREASE_H}
          rx={CREASE_H * 0.4}
          ry={CREASE_H * 0.4}
          fill="none"
          stroke={BLUE}
          strokeWidth={1.8}
        />
      </g>

      <rect
        x={1}
        y={1}
        width={FIELD_WIDTH - 2}
        height={FIELD_HEIGHT - 2}
        rx={FIELD_CORNER}
        ry={FIELD_CORNER}
        fill="none"
        stroke={BOARDS}
        strokeWidth={4}
      />

      {children}
    </svg>
  );
}
