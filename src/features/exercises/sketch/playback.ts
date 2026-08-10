import type { SketchMarker } from './types';

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

// Spieler/Bälle etc. werden anhand ihrer id über zwei Schritte hinweg
// zugeordnet: gemeinsame Elemente werden bewegt, neue blenden ein, entfernte
// blenden aus.
export function interpolateMarkers(from: SketchMarker[], to: SketchMarker[], t: number): MarkerFrame[] {
  const fromIds = new Set(from.map((m) => m.id));
  const frames: MarkerFrame[] = [];

  for (const m of from) {
    const target = to.find((x) => x.id === m.id);
    if (target) {
      frames.push({
        marker: { ...m, x: lerp(m.x, target.x, t), y: lerp(m.y, target.y, t), label: target.label ?? m.label },
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
