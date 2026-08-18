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
  /** Optionaler Kontrollpunkt für eine quadratische Bezier-Kurve statt einer Geraden. */
  control?: SketchPoint;
}

export interface SketchFreehandStroke {
  id: string;
  points: SketchPoint[];
  color: string;
}

export interface SketchComment {
  id: string;
  x: number;
  y: number;
  text: string;
}

// Ein Schritt entspricht einem Zustand ("Frame") der Übung. Mehrere Schritte
// hintereinander ergeben die animierbare Abfolge der Übung.
export interface SketchStepContent {
  markers: SketchMarker[];
  arrows: SketchArrow[];
  freehand: SketchFreehandStroke[];
  comments: SketchComment[];
}

export function createEmptyStepContent(): SketchStepContent {
  return { markers: [], arrows: [], freehand: [], comments: [] };
}

export function cloneStepContent(step: SketchStepContent): SketchStepContent {
  return {
    markers: step.markers.map((m) => ({ ...m })),
    arrows: step.arrows.map((a) => ({
      ...a,
      points: a.points.map((p) => ({ ...p })),
      control: a.control ? { ...a.control } : undefined,
    })),
    freehand: step.freehand.map((f) => ({ ...f, points: f.points.map((p) => ({ ...p })) })),
    comments: step.comments.map((c) => ({ ...c })),
  };
}

export interface SketchDrawing {
  version: 2;
  fieldType: SketchFieldType;
  steps: SketchStepContent[];
}

export function createEmptyDrawing(fieldType: SketchFieldType = 'full'): SketchDrawing {
  return { version: 2, fieldType, steps: [createEmptyStepContent()] };
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
  | 'comment'
  | 'eraser';

export const MARKER_TOOLS: SketchTool[] = ['ball', 'cone', 'player_offense', 'player_defense', 'goal'];
export const ARROW_TOOLS: SketchTool[] = ['path_with_ball', 'path_without_ball', 'pass', 'shot'];
