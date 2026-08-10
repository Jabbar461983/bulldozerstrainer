export type SketchFieldType = 'full' | 'half';

export type SketchMarkerKind = 'ball' | 'cone' | 'player_offense' | 'player_defense' | 'goal';

export interface SketchPoint {
  x: number;
  y: number;
}

export interface SketchMarker {
  id: string;
  kind: SketchMarkerKind;
  x: number;
  y: number;
  label?: string;
  rotation?: number;
}

export type SketchArrowKind = 'path_with_ball' | 'path_without_ball' | 'pass' | 'shot';

export interface SketchArrow {
  id: string;
  kind: SketchArrowKind;
  points: SketchPoint[];
}

export interface SketchFreehandStroke {
  id: string;
  points: SketchPoint[];
  color: string;
}

export interface SketchDrawing {
  version: 1;
  fieldType: SketchFieldType;
  markers: SketchMarker[];
  arrows: SketchArrow[];
  freehand: SketchFreehandStroke[];
}

export function createEmptyDrawing(fieldType: SketchFieldType = 'full'): SketchDrawing {
  return { version: 1, fieldType, markers: [], arrows: [], freehand: [] };
}

export type SketchTool =
  | 'select'
  | 'ball'
  | 'cone'
  | 'player_offense'
  | 'player_defense'
  | 'goal'
  | 'path_with_ball'
  | 'path_without_ball'
  | 'pass'
  | 'shot'
  | 'pen'
  | 'eraser';

export const MARKER_TOOLS: SketchTool[] = ['ball', 'cone', 'player_offense', 'player_defense', 'goal'];
export const ARROW_TOOLS: SketchTool[] = ['path_with_ball', 'path_without_ball', 'pass', 'shot'];
