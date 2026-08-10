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
} from './elements';
import { svgToJpegBlob } from './svgExport';
import type {
  SketchArrowKind,
  SketchDrawing,
  SketchFieldType,
  SketchMarkerKind,
  SketchPoint,
  SketchTool,
} from './types';
import { ARROW_TOOLS, MARKER_TOOLS, createEmptyDrawing } from './types';

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
  const [tool, setTool] = useState<SketchTool>('player_offense');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftPoints, setDraftPoints] = useState<SketchPoint[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const historyRef = useRef<SketchDrawing[]>([]);
  const draggingIdRef = useRef<string | null>(null);
  const draftToolRef = useRef<SketchTool | null>(null);

  function commit(updater: (d: SketchDrawing) => SketchDrawing) {
    setDrawing((prev) => {
      historyRef.current.push(prev);
      if (historyRef.current.length > 50) historyRef.current.shift();
      return updater(prev);
    });
  }

  function handleUndo() {
    const prev = historyRef.current.pop();
    if (prev) {
      setDrawing(prev);
      setSelectedId(null);
    }
  }

  function deleteShape(id: string) {
    commit((d) => ({
      ...d,
      markers: d.markers.filter((m) => m.id !== id),
      arrows: d.arrows.filter((a) => a.id !== id),
      freehand: d.freehand.filter((f) => f.id !== id),
      comments: d.comments.filter((c) => c.id !== id),
    }));
    setSelectedId((cur) => (cur === id ? null : cur));
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
      commit((d) => ({
        ...d,
        markers: [...d.markers, { id, kind: tool as SketchMarkerKind, x: pt.x, y: pt.y }],
      }));
      setSelectedId(id);
      return;
    }

    if (tool === 'comment') {
      const id = crypto.randomUUID();
      commit((d) => ({ ...d, comments: [...d.comments, { id, x: pt.x, y: pt.y, text: '' }] }));
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

    if (draggingIdRef.current && tool === 'select') {
      const id = draggingIdRef.current;
      setDrawing((d) => ({
        ...d,
        markers: d.markers.map((m) => (m.id === id ? { ...m, x: pt.x, y: pt.y } : m)),
        comments: d.comments.map((c) => (c.id === id ? { ...c, x: pt.x, y: pt.y } : c)),
      }));
    }
  }

  function handlePointerUp() {
    const finishedTool = draftToolRef.current;
    if (draftPoints && draftPoints.length >= 2) {
      const id = crypto.randomUUID();
      if (finishedTool === 'pen') {
        commit((d) => ({ ...d, freehand: [...d.freehand, { id, points: draftPoints, color: '#111111' }] }));
      } else if (finishedTool) {
        commit((d) => ({
          ...d,
          arrows: [...d.arrows, { id, kind: finishedTool as SketchArrowKind, points: draftPoints }],
        }));
      }
    }
    setDraftPoints(null);
    draftToolRef.current = null;
    draggingIdRef.current = null;
  }

  function setFieldType(fieldType: SketchFieldType) {
    commit((d) => ({ ...d, fieldType }));
  }

  function updateSelectedLabel(label: string) {
    if (!selectedId) return;
    setDrawing((d) => ({ ...d, markers: d.markers.map((m) => (m.id === selectedId ? { ...m, label } : m)) }));
  }

  function updateSelectedComment(text: string) {
    if (!selectedId) return;
    setDrawing((d) => ({ ...d, comments: d.comments.map((c) => (c.id === selectedId ? { ...c, text } : c)) }));
  }

  async function handleExport(mode: 'download' | 'save') {
    if (!svgRef.current) return;
    setError(null);
    setSaving(true);
    try {
      const blob = await svgToJpegBlob(svgRef.current);
      if (mode === 'download') {
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

  const selectedMarker = drawing.markers.find((m) => m.id === selectedId);
  const isPlayerSelected = selectedMarker?.kind === 'player_offense' || selectedMarker?.kind === 'player_defense';
  const selectedComment = drawing.comments.find((c) => c.id === selectedId);

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

  return (
    <Modal title="Übung zeichnen" onClose={onClose} wide>
      <div className="flex flex-col gap-3">
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
            {drawing.arrows.map((a) => (
              <g key={a.id} onPointerDown={(e) => handleShapePointerDown(e, a.id)}>
                <ArrowShape arrow={a} selected={a.id === selectedId} />
              </g>
            ))}
            {drawing.freehand.map((f) => (
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
            {drawing.markers.map((m) => (
              <g key={m.id} onPointerDown={(e) => handleShapePointerDown(e, m.id)} style={{ cursor: 'pointer' }}>
                <MarkerShape marker={m} selected={m.id === selectedId} />
              </g>
            ))}
            {drawing.comments.map((c) => (
              <g key={c.id} onPointerDown={(e) => handleShapePointerDown(e, c.id)} style={{ cursor: 'pointer' }}>
                <CommentShape comment={c} selected={c.id === selectedId} />
              </g>
            ))}
          </RinkField>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handleUndo} disabled={historyRef.current.length === 0}>
              Rückgängig
            </Button>
            {selectedId && (
              <Button type="button" variant="secondary" onClick={() => deleteShape(selectedId)}>
                Löschen
              </Button>
            )}
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
      </div>
    </Modal>
  );
}
