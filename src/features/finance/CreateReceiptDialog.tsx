import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { Select } from '../../components/Select';
import { createReceipt } from './api';
import { useAuth } from '../../auth/AuthContext';
import { todayIso } from '../../lib/dates';

interface CreateReceiptDialogProps {
  teamId: string;
  season: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateReceiptDialog({ teamId, season, onClose, onCreated }: CreateReceiptDialogProps) {
  const { profile } = useAuth();
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [recipientType, setRecipientType] = useState<'company' | 'person'>('company');
  const [recipientName, setRecipientName] = useState('');
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    setPhotoFile(e.target.files?.[0] ?? null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createReceipt({
        team_id: teamId,
        season,
        type,
        amount: Number(amount),
        recipient_type: recipientType,
        recipient_name: recipientName,
        notes: notes || null,
        date,
        created_by: profile?.id ?? null,
        photoFile,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Beleg konnte nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Neuer Beleg"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form="create-receipt-form" disabled={loading}>
            {loading ? 'Speichern…' : 'Beleg speichern'}
          </Button>
        </>
      }
    >
      <form id="create-receipt-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        <div>
          <Label htmlFor="photo">Beleg-Foto (optional, max. 20 MB)</Label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            onChange={handlePhoto}
            className="block w-full text-sm text-text file:mr-3 file:rounded-xl file:border-0 file:bg-surface-alt file:px-3.5 file:py-2.5 file:text-sm file:font-medium file:text-text"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
