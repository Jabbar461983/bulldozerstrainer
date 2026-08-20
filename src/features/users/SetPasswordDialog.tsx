import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input, Label } from '../../components/Input';
import { setUserPassword } from './api';
import type { UserRow } from './api';
import { generatePassword } from '../../lib/password';

interface SetPasswordDialogProps {
  user: UserRow;
  onClose: () => void;
}

export function SetPasswordDialog({ user, onClose }: SetPasswordDialogProps) {
  const [password, setPassword] = useState(() => generatePassword());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSet() {
    setBusy(true);
    setError(null);
    try {
      await setUserPassword(user.id, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passwort konnte nicht gesetzt werden.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    const text = `Bulldozers Junioren Manager\nE-Mail: ${user.email}\nPasswort: ${password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Zwischenablage evtl. nicht verfügbar - Text bleibt zum manuellen Kopieren sichtbar.
    }
  }

  if (done) {
    return (
      <Modal
        title="Neues Passwort gesetzt"
        onClose={onClose}
        footer={
          <Button type="button" onClick={onClose}>
            Fertig
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            Bitte gib diese Zugangsdaten {user.first_name} {user.last_name} weiter (z.B. per WhatsApp) - es
            wird keine E-Mail verschickt.
          </p>
          <div className="rounded-xl border border-border bg-surface-alt p-3 text-sm">
            <p>
              <span className="text-text-muted">E-Mail: </span>
              <span className="font-medium text-text">{user.email}</span>
            </p>
            <p>
              <span className="text-text-muted">Passwort: </span>
              <span className="font-medium text-text">{password}</span>
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => void handleCopy()} className="self-start">
            {copied ? 'Kopiert ✓' : 'In Zwischenablage kopieren'}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Neues Passwort für ${user.first_name} ${user.last_name}`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="button" disabled={busy} onClick={() => void handleSet()}>
            {busy ? 'Setzen…' : 'Passwort setzen'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="new-password">Neues Passwort</Label>
          <div className="flex gap-2">
            <Input
              id="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1"
            />
            <Button type="button" variant="secondary" onClick={() => setPassword(generatePassword())}>
              Neu generieren
            </Button>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Mind. 8 Zeichen. Das bisherige Passwort wird damit ungültig - anschliessend kannst du das neue
            Passwort weitergeben (z.B. per WhatsApp).
          </p>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
