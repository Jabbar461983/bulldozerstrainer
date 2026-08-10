// Feld-Geometrie, proportional übernommen von drawRink() in trainingPdf.ts,
// damit Sketch-Editor und PDF-Export dieselben Proportionen verwenden.
export const FIELD_WIDTH = 1000;
export const FIELD_HEIGHT = FIELD_WIDTH / 2.4;
export const FIELD_CORNER = FIELD_HEIGHT * 0.18;
export const BLUE_LINE_1_X = FIELD_WIDTH * 0.33;
export const BLUE_LINE_2_X = FIELD_WIDTH * 0.67;
export const CENTER_CIRCLE_R = FIELD_HEIGHT * 0.16;
export const FACEOFF_DOT_DX = FIELD_WIDTH * 0.18;
export const FACEOFF_DOT_DY = FIELD_HEIGHT * 0.26;
export const FACEOFF_CIRCLE_R = FIELD_HEIGHT * 0.09;
export const GOAL_LINE_OFFSET = FIELD_WIDTH * 0.06;
export const CREASE_W = FIELD_WIDTH * 0.045;
export const CREASE_H = FIELD_HEIGHT * 0.2;

// Halbfeld zeigt eine Zone bis kurz hinter die weit entfernte blaue Linie.
export const HALF_FIELD_WIDTH = BLUE_LINE_2_X + FIELD_WIDTH * 0.11;

export function fieldViewBox(fieldType: 'full' | 'half'): string {
  const w = fieldType === 'half' ? HALF_FIELD_WIDTH : FIELD_WIDTH;
  return `0 0 ${w} ${FIELD_HEIGHT}`;
}
