import { useState } from 'react';
import type { MouseEvent } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { deleteReceipt } from './api';
import type { ReceiptRow } from './api';
import { toCsv } from '../../lib/csv';
import { downloadTextFile } from '../../lib/downloadFile';
import { EditReceiptDialog } from './EditReceiptDialog';
import { ReceiptViewDialog } from './ReceiptViewDialog';
import { exportAllReceiptsPdf } from './receiptPdf';

interface FinanceJournalProps {
  receipts: ReceiptRow[];
  startingBalance: number;
  teamName: string;
  season: string;
  onChanged: () => void;
}

export function FinanceJournal({ receipts, startingBalance, teamName, season, onChanged }: FinanceJournalProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptRow | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<ReceiptRow | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  let runningBalance = startingBalance;
  const rows = receipts.map((r, i) => {
    runningBalance += r.type === 'income' ? r.amount : -r.amount;
    return { ...r, balance: runningBalance, bookingNumber: i + 1 };
  });

  async function handleDelete(receipt: ReceiptRow, e: MouseEvent) {
    e.stopPropagation();
    const confirmed = window.confirm('Diesen Beleg wirklich unwiderruflich löschen?');
    if (!confirmed) return;
    setBusyId(receipt.id);
    setError(null);
    try {
      await deleteReceipt(receipt.id, receipt.photo_path);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Beleg konnte nicht gelöscht werden.');
    } finally {
      setBusyId(null);
    }
  }

  function handleEdit(receipt: ReceiptRow, e: MouseEvent) {
    e.stopPropagation();
    setEditingReceipt(receipt);
  }

  function handleExportCsv() {
    const header = ['Buchungsnummer', 'Datum', 'Typ', 'Betrag', 'Empfänger-Typ', 'Empfänger', 'Notizen', 'Saldo'];
    const csvRows = rows.map((r) => [
      r.bookingNumber,
      r.date,
      r.type === 'income' ? 'Einnahme' : 'Ausgabe',
      r.amount.toFixed(2),
      r.recipient_type === 'company' ? 'Firma' : 'Person',
      r.recipient_name,
      r.notes ?? '',
      r.balance.toFixed(2),
    ]);
    const csv = toCsv([header, ...csvRows]);
    const safeName = `journal-${teamName}-${season}`.replace(/[\s/\\]+/g, '_');
    downloadTextFile(`${safeName}.csv`, csv);
  }

  async function handleExportAllPdf() {
    setExportingPdf(true);
    setError(null);
    try {
      await exportAllReceiptsPdf(rows, teamName, season);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF-Export fehlgeschlagen.');
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-text">Journal</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleExportCsv} disabled={rows.length === 0}>
            CSV-Export
          </Button>
          <Button variant="secondary" disabled={rows.length === 0 || exportingPdf} onClick={() => void handleExportAllPdf()}>
            {exportingPdf ? 'Erstelle PDF…' : 'Alle als PDF'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {rows.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Noch keine Belege erfasst.</p>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div
            key={r.id}
            role="button"
            tabIndex={0}
            onClick={() => setViewingReceipt(r)}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && e.key === 'Enter') setViewingReceipt(r);
            }}
            className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-2 text-sm hover:bg-surface-alt"
          >
            <div>
              <p className="font-medium text-text">
                <span className="text-text-muted">Nr. {r.bookingNumber} · </span>
                {r.recipient_name}{' '}
                <span className="text-text-muted">
                  · {new Date(`${r.date}T00:00:00`).toLocaleDateString('de-CH')}
                </span>
              </p>
              {r.notes && <p className="text-text-muted">{r.notes}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={r.type === 'income' ? 'text-success' : 'text-danger'}>
                {r.type === 'income' ? '+' : '-'}CHF {r.amount.toFixed(2)}
              </span>
              <span className="text-text-muted">Saldo: CHF {r.balance.toFixed(2)}</span>
              <Button variant="secondary" onClick={(e) => handleEdit(r, e)}>
                Bearbeiten
              </Button>
              <Button variant="danger" disabled={busyId === r.id} onClick={(e) => void handleDelete(r, e)}>
                Löschen
              </Button>
            </div>
          </div>
        ))}
      </div>

      {editingReceipt && (
        <EditReceiptDialog
          receipt={editingReceipt}
          onClose={() => setEditingReceipt(null)}
          onSaved={() => {
            setEditingReceipt(null);
            onChanged();
          }}
        />
      )}

      {viewingReceipt && (
        <ReceiptViewDialog
          receipt={viewingReceipt}
          bookingNumber={rows.find((r) => r.id === viewingReceipt.id)?.bookingNumber ?? 0}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </div>
  );
}
