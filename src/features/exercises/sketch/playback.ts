import type { SketchArrow, SketchMarker, SketchPoint } from './types';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export interface MarkerFrame {
  marker: SketchMarker;
  opacity: number;
}

// Nur Laufwege (mit/ohne Ball) beschreiben eine Spielerbewegung - Pass und
// Schuss bewegen den Puck, nicht den Spieler.
const PATH_FOLLOW_KINDS = new Set<SketchArrow['kind']>(['path_with_ball', 'path_without_ball']);
const PATH_MATCH_MAX_DISTANCE = 60;

function distance(a: SketchPoint, b: SketchPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Sucht den Laufweg, der am nächsten beim Spieler beginnt - dieser wird für
// die Animation seiner Bewegung verwendet.
function findFollowArrow(marker: SketchMarker, arrows: SketchArrow[]): SketchArrow | null {
  let best: SketchArrow | null = null;
  let bestDistance = PATH_MATCH_MAX_DISTANCE;
  for (const arrow of arrows) {
    if (!PATH_FOLLOW_KINDS.has(arrow.kind)) continue;
    const start = arrow.points[0];
    if (!start) continue;
    const d = distance(marker, start);
    if (d < bestDistance) {
      bestDistance = d;
      best = arrow;
    }
  }
  return best;
}

function quadraticBezierPoint(p0: SketchPoint, control: SketchPoint, p1: SketchPoint, t: number): SketchPoint {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * control.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * control.y + t * t * p1.y,
  };
}

// Abweichung des Laufwegs von der direkten Verbindung seiner Endpunkte bei
// Fortschritt t (0 an beiden Enden). Auf die lineare Spielerbewegung addiert
// ergibt das eine Bahn, die der gezeichneten Kurvenform folgt, aber exakt an
// den tatsächlichen Marker-Positionen von/nach Schritt beginnt und endet.
function arrowCurveOffset(arrow: SketchArrow, t: number): SketchPoint {
  if (!arrow.control) return { x: 0, y: 0 };
  const [p0, p1 = p0] = arrow.points;
  if (!p0) return { x: 0, y: 0 };
  const curved = quadraticBezierPoint(p0, arrow.control, p1, t);
  return {
    x: curved.x - lerp(p0.x, p1.x, t),
    y: curved.y - lerp(p0.y, p1.y, t),
  };
}

// Spieler/Bälle etc. werden anhand ihrer id über zwei Schritte hinweg
// zugeordnet: gemeinsame Elemente werden bewegt, neue blenden ein, entfernte
// blenden aus. Ist für einen Spieler ein Laufweg vorhanden, der bei ihm
// beginnt, folgt seine Bewegung dessen Kurvenform statt der direkten Linie.
export function interpolateMarkers(
  from: SketchMarker[],
  to: SketchMarker[],
  t: number,
  arrows: SketchArrow[] = [],
): MarkerFrame[] {
  const fromIds = new Set(from.map((m) => m.id));
  const frames: MarkerFrame[] = [];

  for (const m of from) {
    const target = to.find((x) => x.id === m.id);
    if (target) {
      const followArrow = findFollowArrow(m, arrows);
      const offset = followArrow ? arrowCurveOffset(followArrow, t) : { x: 0, y: 0 };
      frames.push({
        marker: {
          ...m,
          x: lerp(m.x, target.x, t) + offset.x,
          y: lerp(m.y, target.y, t) + offset.y,
          label: target.label ?? m.label,
        },
        opacity: 1,
      });
    } else {
      frames.push({ marker: m, opacity: 1 - t });
    }
  }

  for (const m of to) {
    if (!fromIds.has(m.id)) {
      frames.push({ marker: m, opacity: t });
    }
  }

  return frames;
}
