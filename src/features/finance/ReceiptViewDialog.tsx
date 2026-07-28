import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import type { ReceiptRow } from './api';
import { exportReceiptPdf } from './receiptPdf';

interface ReceiptViewDialogProps {
  receipt: ReceiptRow;
  bookingNumber: number;
  onClose: () => void;
}

export function ReceiptViewDialog({ receipt, bookingNumber, onClose }: ReceiptViewDialogProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      await exportReceiptPdf(receipt, bookingNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF konnte nicht erstellt werden.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal
      title={`Beleg Nr. ${bookingNumber}`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Schliessen
          </Button>
          <Button type="button" disabled={exporting} onClick={() => void handleExport()}>
            {exporting ? 'Erstelle PDF…' : 'Als PDF exportieren'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-text-muted">Datum</p>
            <p className="text-text">{new Date(`${receipt.date}T00:00:00`).toLocaleDateString('de-CH')}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Typ</p>
            <p className="text-text">{receipt.type === 'income' ? 'Einnahme' : 'Ausgabe'}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Betrag</p>
            <p className={receipt.type === 'income' ? 'text-success' : 'text-danger'}>
              {receipt.type === 'income' ? '+' : '-'}CHF {receipt.amount.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Empfänger</p>
            <p className="text-text">
              {receipt.recipient_name} ({receipt.recipient_type === 'company' ? 'Firma' : 'Person'})
            </p>
          </div>
        </div>

        {receipt.notes && (
          <div>
            <p className="text-xs text-text-muted">Notizen</p>
            <p className="text-text">{receipt.notes}</p>
          </div>
        )}

        <div>
          <p className="mb-1 text-xs text-text-muted">Foto</p>
          {receipt.photoUrl ? (
            <img
              src={receipt.photoUrl}
              alt="Beleg-Foto"
              className="max-h-96 w-full rounded-xl border border-border object-contain"
            />
          ) : (
            <p className="text-text-muted">Kein Foto vorhanden.</p>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
