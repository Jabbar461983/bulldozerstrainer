import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Button } from '../../../components/Button';
import { Select } from '../../../components/Select';
import { RinkField } from './RinkField';
import { SketchDefs, MarkerShape, ArrowShape, FreehandShape, CommentShape } from './elements';
import { interpolateMarkers, easeInOutCubic } from './playback';
import type { SketchFieldType, SketchStepContent } from './types';

interface SketchPlaybackProps {
  fieldType: SketchFieldType;
  steps: SketchStepContent[];
  onExit: () => void;
}

const STEP_DURATION_SECONDS = 1.6;

export function SketchPlayback({ fieldType, steps, onExit }: SketchPlaybackProps) {
  const maxProgress = Math.max(0, steps.length - 1);
  const [playing, setPlaying] = useState(steps.length > 1);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    function tick(ts: number) {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setProgress((p) => {
        const next = p + (dt * speed) / STEP_DURATION_SECONDS;
        if (next >= maxProgress) {
          setPlaying(false);
          lastTsRef.current = null;
          return maxProgress;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);

  const clamped = Math.min(progress, maxProgress);
  const stepIndex = Math.min(Math.floor(clamped), steps.length - 1);
  const t = easeInOutCubic(clamped - stepIndex);
  const fromStep = steps[stepIndex];
  const nextStep = steps[Math.min(stepIndex + 1, steps.length - 1)];
  const markerFrames = interpolateMarkers(fromStep.markers, nextStep.markers, t);
  const atEnd = clamped >= maxProgress;

  function togglePlay() {
    if (!playing && atEnd) setProgress(0);
    setPlaying((p) => !p);
  }

  function jumpToStep(index: number) {
    setPlaying(false);
    setProgress(index);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border">
        <RinkField fieldType={fieldType} className="w-full bg-white">
          <SketchDefs />
          {fromStep.arrows.map((a) => (
            <ArrowShape key={a.id} arrow={a} />
          ))}
          {fromStep.freehand.map((f) => (
            <FreehandShape key={f.id} stroke={f} />
          ))}
          {markerFrames.map(({ marker, opacity }) => (
            <g key={marker.id} opacity={opacity}>
              <MarkerShape marker={marker} />
            </g>
          ))}
          {fromStep.comments.map((c) => (
            <CommentShape key={c.id} comment={c} />
          ))}
        </RinkField>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={togglePlay} disabled={steps.length <= 1}>
          {playing ? 'Pause' : atEnd ? 'Nochmal' : 'Abspielen'}
        </Button>

        <div className="flex flex-1 items-center gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => jumpToStep(i)}
              aria-label={`Zu Schritt ${i + 1} springen`}
              className={clsx('h-2 flex-1 rounded-full transition', i <= stepIndex ? 'bg-accent' : 'bg-border')}
            />
          ))}
        </div>

        <Select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-24">
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
        </Select>
      </div>

      <p className="text-center text-xs text-text-muted">
        Schritt {stepIndex + 1} von {steps.length}
      </p>

      <div className="flex justify-end border-t border-border pt-3">
        <Button type="button" variant="secondary" onClick={onExit}>
          Zurück zur Bearbeitung
        </Button>
      </div>
    </div>
  );
}
