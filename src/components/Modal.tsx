import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  title: ReactNode;
  ariaLabel?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Nutzt fast die gesamte Bildschirmfläche - für Bearbeitungsmasken mit viel Inhalt. */
  fullscreen?: boolean;
}

export function Modal({ title, ariaLabel, onClose, children, footer, wide, fullscreen }: ModalProps) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
        className={`flex w-full flex-col rounded-t-lg border border-border bg-surface shadow-2xl sm:rounded-lg ${
          fullscreen
            ? 'h-[95vh] max-h-[95vh] sm:h-[92vh] sm:max-h-[92vh] sm:max-w-5xl'
            : `max-h-[90vh] ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h2 className="flex min-w-0 flex-1 items-center gap-2 text-base font-semibold tracking-tight text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schliessen"
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-alt hover:text-text"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface-alt px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
