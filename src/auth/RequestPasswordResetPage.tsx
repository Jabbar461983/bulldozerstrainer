import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input, Label } from '../components/Input';
import { Card } from '../components/Card';

export function RequestPasswordResetPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/passwort-zuruecksetzen`,
    });
    setLoading(false);
    if (resetError) {
      setError('Der Reset-Link konnte nicht gesendet werden.');
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-bg px-4 py-10">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold text-text">Passwort zurücksetzen</h1>
        <p className="mb-6 text-sm text-text-muted">
          Wir senden dir einen Link zum Zurücksetzen an deine E-Mail-Adresse.
        </p>

        {sent ? (
          <p className="rounded-xl bg-success/10 p-3 text-sm text-success">
            E-Mail gesendet. Bitte Posteingang prüfen.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Sende…' : 'Link senden'}
            </Button>
          </form>
        )}

        <div className="mt-4 text-center">
          <Link to="/login" className="text-sm text-accent hover:underline">
            Zurück zur Anmeldung
          </Link>
        </div>
      </Card>
    </div>
  );
}
