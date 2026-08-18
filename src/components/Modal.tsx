import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  title: ReactNode;
  ariaLabel?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ title, ariaLabel, onClose, children, footer, wide }: ModalProps) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
        className={`flex max-h-[90vh] w-full flex-col rounded-t-2xl border border-border bg-surface shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h2 className="flex min-w-0 flex-1 items-center gap-2 text-base font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schliessen"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-alt"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
