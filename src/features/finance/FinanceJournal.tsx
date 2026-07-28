import { useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { deleteReceipt } from './api';
import type { ReceiptRow } from './api';
import { toCsv } from '../../lib/csv';
import { EditReceiptDialog } from './EditReceiptDialog';

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

  let runningBalance = startingBalance;
  const rows = receipts.map((r) => {
    runningBalance += r.type === 'income' ? r.amount : -r.amount;
    return { ...r, balance: runningBalance };
  });

  async function handleDelete(receipt: ReceiptRow) {
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

  function handleExport() {
    const header = ['Datum', 'Typ', 'Betrag', 'Empfänger-Typ', 'Empfänger', 'Notizen', 'Saldo'];
    const csvRows = rows.map((r) => [
      r.date,
      r.type === 'income' ? 'Einnahme' : 'Ausgabe',
      r.amount.toFixed(2),
      r.recipient_type === 'company' ? 'Firma' : 'Person',
      r.recipient_name,
      r.notes ?? '',
      r.balance.toFixed(2),
    ]);
    const csv = toCsv([header, ...csvRows]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = `journal-${teamName}-${season}`.replace(/[\s/\\]+/g, '_');
    a.download = `${safeName}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-text">Journal</p>
        <Button variant="secondary" onClick={handleExport} disabled={rows.length === 0}>
          CSV-Export
        </Button>
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
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-2 text-sm"
          >
            <div>
              <p className="font-medium text-text">
                {r.recipient_name}{' '}
                <span className="text-text-muted">· {new Date(`${r.date}T00:00:00`).toLocaleDateString('de-CH')}</span>
              </p>
              {r.notes && <p className="text-text-muted">{r.notes}</p>}
              {r.photoUrl && (
                <a href={r.photoUrl} target="_blank" rel="noreferrer" className="text-accent underline">
                  Foto ansehen
                </a>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={r.type === 'income' ? 'text-success' : 'text-danger'}>
                {r.type === 'income' ? '+' : '-'}CHF {r.amount.toFixed(2)}
              </span>
              <span className="text-text-muted">Saldo: CHF {r.balance.toFixed(2)}</span>
              <Button variant="secondary" onClick={() => setEditingReceipt(r)}>
                Bearbeiten
              </Button>
              <Button variant="danger" disabled={busyId === r.id} onClick={() => void handleDelete(r)}>
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
    </div>
  );
}
