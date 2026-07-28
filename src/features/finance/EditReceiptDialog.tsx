import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { Select } from '../../components/Select';
import { updateReceipt } from './api';
import type { ReceiptRow } from './api';

interface EditReceiptDialogProps {
  receipt: ReceiptRow;
  onClose: () => void;
  onSaved: () => void;
}

export function EditReceiptDialog({ receipt, onClose, onSaved }: EditReceiptDialogProps) {
  const [type, setType] = useState(receipt.type);
  const [amount, setAmount] = useState(String(receipt.amount));
  const [recipientType, setRecipientType] = useState(receipt.recipient_type);
  const [recipientName, setRecipientName] = useState(receipt.recipient_name);
  const [date, setDate] = useState(receipt.date);
  const [notes, setNotes] = useState(receipt.notes ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateReceipt(receipt.id, {
        type,
        amount: Number(amount),
        recipient_type: recipientType,
        recipient_name: recipientName,
        date,
        notes: notes || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Änderungen konnten nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Beleg bearbeiten"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="edit-receipt-form" disabled={loading}>
            {loading ? 'Speichern…' : 'Speichern'}
          </Button>
        </>
      }
    >
      <form id="edit-receipt-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="type">Typ</Label>
            <Select id="type" value={type} onChange={(e) => setType(e.target.value as 'income' | 'expense')}>
              <option value="expense">Ausgabe</option>
              <option value="income">Einnahme</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="amount">Betrag (CHF)</Label>
            <Input
              id="amount"
              type="number"
              step="0.05"
              min={0}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="recipientType">Empfänger-Typ</Label>
            <Select
              id="recipientType"
              value={recipientType}
              onChange={(e) => setRecipientType(e.target.value as 'company' | 'person')}
            >
              <option value="company">Firma</option>
              <option value="person">Person</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="recipientName">Empfänger</Label>
            <Input
              id="recipientName"
              required
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="date">Datum</Label>
          <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="notes">Notizen (optional)</Label>
          <textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>

        {receipt.photoUrl && (
          <div>
            <Label>Beleg-Foto</Label>
            <a href={receipt.photoUrl} target="_blank" rel="noreferrer" className="text-sm text-accent underline">
              Foto ansehen
            </a>
            <p className="mt-1 text-xs text-text-muted">Das Foto kann nachträglich nicht ersetzt werden.</p>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
