import { useRef, useState } from 'react';
import clsx from 'clsx';
import { Modal } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { RinkField } from './RinkField';
import {
  SketchDefs,
  MarkerShape,
  ArrowShape,
  FreehandShape,
  CommentShape,
  MarkerToolIcon,
  ArrowToolIcon,
  UtilityToolIcon,
  MARKER_LABELS,
  ARROW_LABELS,
  getArrowControlPoint,
} from './elements';
import { SketchPlayback } from './SketchPlayback';
import { svgToJpegBlob } from './svgExport';
import type {
  SketchArrowKind,
  SketchDrawing,
  SketchFieldType,
  SketchMarkerKind,
  SketchPoint,
  SketchStepContent,
  SketchTool,
} from './types';
import { ARROW_TOOLS, MARKER_TOOLS, cloneStepContent, createEmptyDrawing } from './types';

interface ExerciseSketchEditorProps {
  initialDrawing?: SketchDrawing;
  onClose: () => void;
  onSave: (jpegBlob: Blob, drawing: SketchDrawing) => Promise<void> | void;
}

const MARKER_TOOL_ORDER: SketchMarkerKind[] = ['player_offense', 'player_defense', 'ball', 'cone', 'goal'];
const ARROW_TOOL_ORDER: SketchArrowKind[] = ['path_with_ball', 'path_without_ball', 'pass', 'shot'];

function getSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): SketchPoint {
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  return {
    x: ((clientX - rect.left) / rect.width) * viewBox.width + viewBox.x,
    y: ((clientY - rect.top) / rect.height) * viewBox.height + viewBox.y,
  };
}

export function ExerciseSketchEditor({ initialDrawing, onClose, onSave }: ExerciseSketchEditorProps) {
  const [drawing, setDrawing] = useState<SketchDrawing>(initialDrawing ?? createEmptyDrawing());
  const [mode, setMode] = useState<'edit' | 'play'>('edit');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [tool, setTool] = useState<SketchTool>('player_offense');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftPoints, setDraftPoints] = useState<SketchPoint[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const pastRef = useRef<SketchDrawing[]>([]);
  const futureRef = useRef<SketchDrawing[]>([]);
  const draggingIdRef = useRef<string | null>(null);
  const draftToolRef = useRef<SketchTool | null>(null);
  const curveDragIdRef = useRef<string | null>(null);

  // Nach Undo/Redo/Löschen eines Schritts kann der Index kurzzeitig über das
  // Ende hinauszeigen - hier defensiv kappen statt den Index separat zu pflegen.
  const stepIndex = Math.min(currentStepIndex, drawing.steps.length - 1);
  const currentStep = drawing.steps[stepIndex];

  function commit(updater: (d: SketchDrawing) => SketchDrawing) {
    setDrawing((prev) => {
      pastRef.current.push(prev);
      if (pastRef.current.length > 50) pastRef.current.shift();
      futureRef.current = [];
      return updater(prev);
    });
  }

  function updateCurrentStep(updater: (step: SketchStepContent) => SketchStepContent) {
    commit((d) => ({ ...d, steps: d.steps.map((s, i) => (i === stepIndex ? updater(s) : s)) }));
  }

  function updateCurrentStepLive(updater: (step: SketchStepContent) => SketchStepContent) {
    setDrawing((d) => ({ ...d, steps: d.steps.map((s, i) => (i === stepIndex ? updater(s) : s)) }));
  }

  function handleUndo() {
    const prev = pastRef.current.pop();
    if (prev) {
      setDrawing((current) => {
        futureRef.current.push(current);
        return prev;
      });
      setSelectedId(null);
    }
  }

  function handleRedo() {
    const next = futureRef.current.pop();
    if (next) {
      setDrawing((current) => {
        pastRef.current.push(current);
        return next;
      });
      setSelectedId(null);
    }
  }

  function deleteShape(id: string) {
    updateCurrentStep((s) => ({
      markers: s.markers.filter((m) => m.id !== id),
      arrows: s.arrows.filter((a) => a.id !== id),
      freehand: s.freehand.filter((f) => f.id !== id),
      comments: s.comments.filter((c) => c.id !== id),
    }));
    setSelectedId((cur) => (cur === id ? null : cur));
  }

  function clearAll() {
    updateCurrentStep(() => ({ markers: [], arrows: [], freehand: [], comments: [] }));
    setSelectedId(null);
  }

  function addStep() {
    commit((d) => {
      const steps = [...d.steps];
      steps.splice(stepIndex + 1, 0, cloneStepContent(d.steps[stepIndex]));
      return { ...d, steps };
    });
    setCurrentStepIndex(stepIndex + 1);
    setSelectedId(null);
  }

  function deleteStep(index: number) {
    if (drawing.steps.length <= 1) return;
    commit((d) => ({ ...d, steps: d.steps.filter((_, i) => i !== index) }));
    setCurrentStepIndex((i) => Math.max(0, Math.min(i, drawing.steps.length - 2)));
    setSelectedId(null);
  }

  function goToStep(index: number) {
    setCurrentStepIndex(index);
    setSelectedId(null);
  }

  function handleShapePointerDown(e: React.PointerEvent, id: string) {
    if (tool === 'select') {
      e.stopPropagation();
      setSelectedId(id);
      draggingIdRef.current = id;
    } else if (tool === 'eraser') {
      e.stopPropagation();
      deleteShape(id);
    }
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const pt = getSvgPoint(svgRef.current, e.clientX, e.clientY);

    if (MARKER_TOOLS.includes(tool)) {
      const id = crypto.randomUUID();
      updateCurrentStep((s) => ({
        ...s,
        markers: [...s.markers, { id, kind: tool as SketchMarkerKind, x: pt.x, y: pt.y }],
      }));
      setSelectedId(id);
      return;
    }

    if (tool === 'comment') {
      const id = crypto.randomUUID();
      updateCurrentStep((s) => ({ ...s, comments: [...s.comments, { id, x: pt.x, y: pt.y, text: '' }] }));
      setSelectedId(id);
      return;
    }

    if (ARROW_TOOLS.includes(tool) || tool === 'pen') {
      draftToolRef.current = tool;
      setDraftPoints([pt]);
      return;
    }

    if (tool === 'select') setSelectedId(null);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const pt = getSvgPoint(svgRef.current, e.clientX, e.clientY);

    if (draftPoints) {
      if (draftToolRef.current === 'pen') {
        setDraftPoints((prev) => (prev ? [...prev, pt] : prev));
      } else {
        setDraftPoints((prev) => (prev ? [prev[0], pt] : prev));
      }
      return;
    }

    if (curveDragIdRef.current) {
      const id = curveDragIdRef.current;
      updateCurrentStepLive((s) => ({ ...s, arrows: s.arrows.map((a) => (a.id === id ? { ...a, control: pt } : a)) }));
      return;
    }

    if (draggingIdRef.current && tool === 'select') {
      const id = draggingIdRef.current;
      updateCurrentStepLive((s) => ({
        ...s,
        markers: s.markers.map((m) => (m.id === id ? { ...m, x: pt.x, y: pt.y } : m)),
        comments: s.comments.map((c) => (c.id === id ? { ...c, x: pt.x, y: pt.y } : c)),
      }));
    }
  }

  function handlePointerUp() {
    const finishedTool = draftToolRef.current;
    if (draftPoints && draftPoints.length >= 2) {
      const id = crypto.randomUUID();
      if (finishedTool === 'pen') {
        updateCurrentStep((s) => ({ ...s, freehand: [...s.freehand, { id, points: draftPoints, color: '#111111' }] }));
      } else if (finishedTool) {
        updateCurrentStep((s) => ({
          ...s,
          arrows: [...s.arrows, { id, kind: finishedTool as SketchArrowKind, points: draftPoints }],
        }));
        setSelectedId(id);
      }
    }
    setDraftPoints(null);
    draftToolRef.current = null;
    draggingIdRef.current = null;
    curveDragIdRef.current = null;
  }

  function handleCurveHandlePointerDown(e: React.PointerEvent, arrowId: string) {
    e.stopPropagation();
    curveDragIdRef.current = arrowId;
  }

  function resetArrowCurve(arrowId: string) {
    updateCurrentStep((s) => ({ ...s, arrows: s.arrows.map((a) => (a.id === arrowId ? { ...a, control: undefined } : a)) }));
  }

  function setFieldType(fieldType: SketchFieldType) {
    commit((d) => ({ ...d, fieldType }));
  }

  function updateSelectedLabel(label: string) {
    if (!selectedId) return;
    updateCurrentStepLive((s) => ({ ...s, markers: s.markers.map((m) => (m.id === selectedId ? { ...m, label } : m)) }));
  }

  function updateSelectedComment(text: string) {
    if (!selectedId) return;
    updateCurrentStepLive((s) => ({ ...s, comments: s.comments.map((c) => (c.id === selectedId ? { ...c, text } : c)) }));
  }

  async function handleExport(exportMode: 'download' | 'save') {
    if (!svgRef.current) return;
    setError(null);
    setSaving(true);
    try {
      const blob = await svgToJpegBlob(svgRef.current);
      if (exportMode === 'download') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'uebungsskizze.jpg';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        await onSave(blob, drawing);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  const selectedMarker = currentStep.markers.find((m) => m.id === selectedId);
  const isPlayerSelected = selectedMarker?.kind === 'player_offense' || selectedMarker?.kind === 'player_defense';
  const selectedComment = currentStep.comments.find((c) => c.id === selectedId);
  const selectedArrow = currentStep.arrows.find((a) => a.id === selectedId);

  function ToolButton({
    active,
    onClick,
    icon,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    icon?: React.ReactNode;
    children: React.ReactNode;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          'flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
          active ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted hover:bg-surface-alt',
        )}
      >
        {icon}
        {children}
      </button>
    );
  }

  function HistoryButton({ direction, onClick, disabled }: { direction: 'back' | 'forward'; onClick: () => void; disabled: boolean }) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={direction === 'back' ? 'Rückgängig' : 'Wiederholen'}
        title={direction === 'back' ? 'Rückgängig' : 'Wiederholen'}
        className="flex size-9 items-center justify-center rounded-full border border-border text-text-muted transition hover:bg-surface-alt disabled:opacity-30"
      >
        <svg viewBox="0 0 20 20" width={18} height={18} aria-hidden="true">
          <line
            x1={direction === 'back' ? 16 : 4}
            y1={10}
            x2={direction === 'back' ? 6 : 14}
            y2={10}
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <path
            d={direction === 'back' ? 'M10,5 L5,10 L10,15' : 'M10,5 L15,10 L10,15'}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
  }

  return (
    <Modal title="Übung zeichnen" onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        {mode === 'play' ? (
          <SketchPlayback fieldType={drawing.fieldType} steps={drawing.steps} onExit={() => setMode('edit')} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Feld</span>
              <ToolButton active={drawing.fieldType === 'full'} onClick={() => setFieldType('full')}>
                Ganzes Feld
              </ToolButton>
              <ToolButton active={drawing.fieldType === 'half'} onClick={() => setFieldType('half')}>
                Halbes Feld
              </ToolButton>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                <ToolButton active={tool === 'select'} onClick={() => setTool('select')} icon={<UtilityToolIcon tool="select" />}>
                  Auswahl
                </ToolButton>
                {MARKER_TOOL_ORDER.map((kind) => (
                  <ToolButton key={kind} active={tool === kind} onClick={() => setTool(kind)} icon={<MarkerToolIcon kind={kind} />}>
                    {MARKER_LABELS[kind]}
                  </ToolButton>
                ))}
                <ToolButton active={tool === 'comment'} onClick={() => setTool('comment')} icon={<UtilityToolIcon tool="comment" />}>
                  Kommentar
                </ToolButton>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ARROW_TOOL_ORDER.map((kind) => (
                  <ToolButton key={kind} active={tool === kind} onClick={() => setTool(kind)} icon={<ArrowToolIcon kind={kind} />}>
                    {ARROW_LABELS[kind]}
                  </ToolButton>
                ))}
                <ToolButton active={tool === 'pen'} onClick={() => setTool('pen')} icon={<UtilityToolIcon tool="pen" />}>
                  Freihand
                </ToolButton>
                <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} icon={<UtilityToolIcon tool="eraser" />}>
                  Radieren
                </ToolButton>
              </div>
            </div>

            {isPlayerSelected && (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-alt p-2.5">
                <span className="text-xs font-medium text-text-muted">Label</span>
                <Input
                  value={selectedMarker?.label ?? ''}
                  onChange={(e) => updateSelectedLabel(e.target.value.slice(0, 3))}
                  placeholder="z.B. A"
                  className="max-w-24"
                />
              </div>
            )}

            {selectedComment && (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-alt p-2.5">
                <span className="text-xs font-medium text-text-muted">Kommentar</span>
                <Input
                  value={selectedComment.text}
                  onChange={(e) => updateSelectedComment(e.target.value)}
                  placeholder="z.B. 2x wiederholen"
                  className="flex-1"
                />
              </div>
            )}

            {selectedArrow && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-alt p-2.5">
                <span className="text-xs text-text-muted">Blauen Punkt auf der Linie ziehen, um sie zu einer Kurve zu biegen.</span>
                {selectedArrow.control && (
                  <Button type="button" variant="secondary" onClick={() => resetArrowCurve(selectedArrow.id)}>
                    Gerade
                  </Button>
                )}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-border">
              <RinkField
                fieldType={drawing.fieldType}
                svgRef={svgRef}
                className="w-full bg-white"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <SketchDefs />
                {currentStep.arrows.map((a) => (
                  <g key={a.id} onPointerDown={(e) => handleShapePointerDown(e, a.id)}>
                    <ArrowShape arrow={a} selected={a.id === selectedId} />
                  </g>
                ))}
                {selectedArrow && (
                  <circle
                    cx={getArrowControlPoint(selectedArrow).x}
                    cy={getArrowControlPoint(selectedArrow).y}
                    r={7}
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth={2}
                    style={{ cursor: 'grab' }}
                    data-sketch-ui="true"
                    onPointerDown={(e) => handleCurveHandlePointerDown(e, selectedArrow.id)}
                  />
                )}
                {currentStep.freehand.map((f) => (
                  <g key={f.id} onPointerDown={(e) => handleShapePointerDown(e, f.id)}>
                    <FreehandShape stroke={f} selected={f.id === selectedId} />
                  </g>
                ))}
                {draftPoints && draftToolRef.current && ARROW_TOOL_ORDER.includes(draftToolRef.current as SketchArrowKind) && (
                  <ArrowShape arrow={{ id: 'draft', kind: draftToolRef.current as SketchArrowKind, points: draftPoints }} />
                )}
                {draftPoints && draftToolRef.current === 'pen' && (
                  <FreehandShape stroke={{ id: 'draft', points: draftPoints, color: '#111111' }} />
                )}
                {currentStep.markers.map((m) => (
                  <g key={m.id} onPointerDown={(e) => handleShapePointerDown(e, m.id)} style={{ cursor: 'pointer' }}>
                    <MarkerShape marker={m} selected={m.id === selectedId} />
                  </g>
                ))}
                {currentStep.comments.map((c) => (
                  <g key={c.id} onPointerDown={(e) => handleShapePointerDown(e, c.id)} style={{ cursor: 'pointer' }}>
                    <CommentShape comment={c} selected={c.id === selectedId} />
                  </g>
                ))}
              </RinkField>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Ablauf</span>
              {drawing.steps.map((_, i) => (
                <div key={i} className="group relative">
                  <button
                    type="button"
                    onClick={() => goToStep(i)}
                    className={clsx(
                      'flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-medium transition',
                      i === stepIndex ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted hover:bg-surface-alt',
                    )}
                  >
                    Schritt {i + 1}
                  </button>
                  {drawing.steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => deleteStep(i)}
                      aria-label={`Schritt ${i + 1} löschen`}
                      className="absolute -right-1.5 -top-1.5 hidden size-4 items-center justify-center rounded-full bg-danger text-[10px] text-white group-hover:flex"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addStep}
                className="flex min-h-8 items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-text-muted transition hover:bg-surface-alt"
              >
                + Schritt
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HistoryButton direction="back" onClick={handleUndo} disabled={pastRef.current.length === 0} />
                <HistoryButton direction="forward" onClick={handleRedo} disabled={futureRef.current.length === 0} />
                {selectedId && (
                  <Button type="button" variant="secondary" onClick={() => deleteShape(selectedId)}>
                    Element löschen
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={clearAll}>
                  Alles löschen
                </Button>
                <Button type="button" variant="secondary" onClick={() => setMode('play')} disabled={drawing.steps.length <= 1}>
                  ▶ Abspielen
                </Button>
              </div>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              <Button type="button" variant="secondary" onClick={onClose}>
                Abbrechen
              </Button>
              <Button type="button" variant="secondary" disabled={saving} onClick={() => void handleExport('download')}>
                Als JPG herunterladen
              </Button>
              <Button type="button" disabled={saving} onClick={() => void handleExport('save')}>
                {saving ? 'Speichert…' : 'In Übung übernehmen'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
