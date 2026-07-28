import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Button } from '../components/Button';
import { Input, Label } from '../components/Input';
import { Card } from '../components/Card';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.');
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-bg px-4 py-10">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-bold">
            JM
          </div>
          <h1 className="text-lg font-semibold text-text">Junioren Manager</h1>
          <p className="text-sm text-text-muted">Anmeldung für Trainer &amp; Admin</p>
        </div>

        {!isSupabaseConfigured && (
          <p className="mb-4 rounded-xl bg-warning/10 p-3 text-sm text-warning">
            Supabase ist noch nicht konfiguriert (.env.local fehlt).
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email">E-Mail-Adresse</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Anmelden…' : 'Anmelden'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/passwort-vergessen" className="text-sm text-accent hover:underline">
            Passwort vergessen?
          </Link>
        </div>
      </Card>
    </div>
  );
}
