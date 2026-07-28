import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './Button';

export function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Service-Worker-Registrierung fehlgeschlagen:', error);
    },
  });

  if (!offlineReady && !needRefresh) return null;

  function dismiss() {
    setOfflineReady(false);
    setNeedRefresh(false);
  }

  return (
    <div className="fixed inset-x-4 bottom-20 z-30 mx-auto flex max-w-md flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3 shadow-lg sm:bottom-4">
      <p className="text-sm text-text">
        {needRefresh ? 'Neue Version verfügbar.' : 'App ist jetzt offline verfügbar.'}
      </p>
      <div className="flex gap-2">
        {needRefresh && <Button onClick={() => void updateServiceWorker(true)}>Aktualisieren</Button>}
        <Button variant="secondary" onClick={dismiss}>
          Schliessen
        </Button>
      </div>
    </div>
  );
}
