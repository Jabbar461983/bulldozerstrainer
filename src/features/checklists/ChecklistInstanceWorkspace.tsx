import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { fetchChecklistInstances, toggleChecklistItem, saveChecklistCompletion, saveChecklistProgress, createChecklistInstance } from './api';
import type { ChecklistRow, ChecklistInstanceRow } from './api';
import { ChecklistItemAttachments } from './ChecklistItemAttachments';
import { supabase } from '../../lib/supabase';

interface ChecklistInstanceWorkspaceProps {
  checklist: ChecklistRow;
  teamId: string;
  onClose: () => void;
}

export function ChecklistInstanceWorkspace({
  checklist,
  teamId,
  onClose,
}: ChecklistInstanceWorkspaceProps) {
  const [instances, setInstances] = useState<ChecklistInstanceRow[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<ChecklistInstanceRow | null>(null);
  const [globalNote, setGlobalNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [completionPhotos, setCompletionPhotos] = useState<{ id: string; url: string }[]>([]);
  const [showConfirmArchive, setShowConfirmArchive] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchChecklistInstances(checklist.id);
        const filtered = data.filter((i) => !i.team_id || i.team_id === teamId);
        setInstances(filtered);

        if (filtered.length === 0) {
          // Automatisch neue Instanz erstellen
          await createChecklistInstance({
            checklist_id: checklist.id,
            team_id: teamId,
            event_date: null,
            event_context: null,
          });
          // Neu laden nach Erstellung
          const newData = await fetchChecklistInstances(checklist.id);
          const newFiltered = newData.filter((i) => !i.team_id || i.team_id === teamId);
          setInstances(newFiltered);
          if (newFiltered.length > 0) {
            setSelectedInstance(newFiltered[0]);
            setGlobalNote(newFiltered[0].notes || '');
          }
        } else if (filtered.length === 1) {
          setSelectedInstance(filtered[0]);
          setGlobalNote(filtered[0].notes || '');
        }
        // Wenn mehrere: Benutzer muss auswählen
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      }
    }
    void load();
  }, [checklist.id, teamId]);

  async function handleToggleItem(itemId: string) {
    if (!selectedInstance) return;
    setLoading(true);
    try {
      await toggleChecklistItem({
        instance_id: selectedInstance.id,
        item_id: itemId,
      });

      const completion = selectedInstance.completions[itemId];
      setSelectedInstance({
        ...selectedInstance,
        completions: {
          ...selectedInstance.completions,
          [itemId]: completion
            ? undefined
            : {
                id: `temp-${Date.now()}`,
                checklist_instance_id: selectedInstance.id,
                checklist_item_id: itemId,
                user_id: 'current',
                notes: null,
                completed_at: new Date().toISOString(),
              },
        },
        progress: {
          total: selectedInstance.progress.total,
          completed: completion
            ? selectedInstance.progress.completed - 1
            : selectedInstance.progress.completed + 1,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProgress() {
    if (!selectedInstance) return;

    setLoading(true);
    try {
      await saveChecklistProgress({
        instance_id: selectedInstance.id,
        notes: globalNote,
      });
      setMessage('Fortschritt gespeichert ✓');
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file || !selectedInstance) return;

    setUploadingPhoto(true);
    setError(null);
    try {
      // Create a temporary item for completion photos
      const tempItemId = `completion-${selectedInstance.id}`;
      const fileName = `Abschluss_${selectedInstance.id}_${Date.now()}_${file.name}`;
      const filePath = `checklist-completion/${selectedInstance.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: signedUrl } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      setCompletionPhotos([
        ...completionPhotos,
        { id: tempItemId + Date.now(), url: signedUrl.publicUrl },
      ]);
      e.currentTarget.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Foto konnte nicht hochgeladen werden');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRemovePhoto(photoId: string) {
    setCompletionPhotos(completionPhotos.filter((p) => p.id !== photoId));
  }

  async function handleSave() {
    if (!selectedInstance) return;

    const isPending = selectedInstance.progress.completed < selectedInstance.progress.total;
    if (isPending) {
      setError(`Noch ${selectedInstance.progress.total - selectedInstance.progress.completed} von ${selectedInstance.progress.total} Punkte offen`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    setShowConfirmArchive(true);
  }

  async function handleConfirmArchive() {
    if (!selectedInstance) return;

    setShowConfirmArchive(false);
    setLoading(true);
    try {
      const notesWithPhotos = completionPhotos.length > 0
        ? `${globalNote}\n\n[Fotos: ${completionPhotos.length}]`
        : globalNote;

      await saveChecklistCompletion({
        instance_id: selectedInstance.id,
        notes: notesWithPhotos,
      });
      setMessage('Checkliste archiviert ✓');
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  }

  if (instances.length > 1 && !selectedInstance) {
    return (
      <div className="space-y-4">
        <Button onClick={onClose} variant="secondary">
          ← Zurück
        </Button>
        <h2 className="text-xl font-bold">Instanz auswählen</h2>
        <div className="space-y-2">
          {instances.map((instance) => (
            <Card
              key={instance.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedInstance(instance);
                setGlobalNote(instance.notes || '');
                setCompletionPhotos([]);
              }}
              className="cursor-pointer hover:bg-surface-alt"
            >
              <div>
                {instance.event_date && (
                  <p className="font-semibold text-accent">{instance.event_date}</p>
                )}
                {instance.event_context && (
                  <p className="text-sm text-text-muted">{instance.event_context}</p>
                )}
                <p className="text-xs text-text-muted mt-1">
                  Fortschritt: {instance.progress.completed} / {instance.progress.total}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedInstance) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-text-muted">Laden...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Button onClick={onClose} variant="secondary">
            ← Zurück
          </Button>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-center">{selectedInstance.checklistTitle}</h1>
          {selectedInstance.teamName && (
            <p className="text-sm text-text-muted text-center">{selectedInstance.teamName}</p>
          )}
          {selectedInstance.event_date && (
            <p className="text-xs text-text-muted text-center">{selectedInstance.event_date}</p>
          )}
          {selectedInstance.event_context && (
            <p className="text-xs text-text-muted text-center">{selectedInstance.event_context}</p>
          )}
        </div>
        <div />
      </div>

      {error && (
        <div className="rounded-lg bg-error/10 p-4 text-error text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg bg-accent/10 p-4 text-accent text-sm font-medium">
          {message}
        </div>
      )}

      <Card className="bg-surface-alt">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Fortschritt</span>
            <span className="text-lg font-bold text-accent">
              {selectedInstance.progress.completed} von {selectedInstance.progress.total}
            </span>
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full transition-all"
              style={{
                width: `${(selectedInstance.progress.completed / selectedInstance.progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      </Card>

      <div className="space-y-2 max-h-[calc(100vh-500px)] overflow-y-auto">
        {selectedInstance.items.map((item) => {
          const isCompleted = !!selectedInstance.completions[item.id];
          const indent = item.parent_id ? 'ml-6' : 'ml-0';
          return (
            <Card key={item.id} className={`space-y-2 ${indent}`}>
              <label className="flex items-center gap-3 cursor-pointer p-0 hover:bg-surface-alt rounded transition">
                <input
                  type="checkbox"
                  checked={isCompleted}
                  onChange={() => void handleToggleItem(item.id)}
                  disabled={loading}
                  className="rounded border-border w-5 h-5"
                />
                <span className={`flex-1 font-medium ${isCompleted ? 'line-through text-text-muted' : 'text-text'}`}>
                  {item.title}
                </span>
              </label>
              {isCompleted && (
                <div className="ml-8">
                  <ChecklistItemAttachments itemId={item.id} />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={handleSaveProgress}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          {loading ? 'Speichert...' : '💾 Zwischenspeichern'}
        </Button>
      </div>

      {selectedInstance.progress.completed === selectedInstance.progress.total && (
        <Card className="bg-surface-alt space-y-3">
          <label className="block text-sm font-semibold text-text">Abschließende Notiz</label>
          <textarea
            value={globalNote}
            onChange={(e) => setGlobalNote(e.target.value)}
            placeholder="Notiz zum Abschluss der Checkliste..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-muted focus:border-accent focus:outline-none resize-none"
            rows={3}
            disabled={loading}
          />

          <div className="border-t border-border pt-3">
            <label className="block text-xs font-semibold text-text mb-2">Fotos (Defekte, Müll, etc.)</label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium hover:bg-surface p-2 rounded">
              <input
                type="file"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto || loading}
                className="hidden"
                accept="image/*"
              />
              📸 {uploadingPhoto ? 'Lädt...' : 'Foto hinzufügen'}
            </label>

            {completionPhotos.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-accent">{completionPhotos.length} Foto(s)</p>
                {completionPhotos.map((photo) => (
                  <div key={photo.id} className="flex items-center gap-2 text-xs bg-surface p-1 rounded">
                    <a
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline flex-1"
                    >
                      🖼 Foto
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="text-error hover:font-bold"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      <Button
        onClick={handleSave}
        disabled={loading || selectedInstance.progress.completed < selectedInstance.progress.total}
        className="w-full"
      >
        {loading ? 'Archiviert...' : '✓ Checkliste komplett erledigt & archivieren'}
      </Button>

      {showConfirmArchive && (
        <Card className="bg-warning/10 border border-warning space-y-4 fixed inset-0 m-auto w-96 p-6 rounded-lg shadow-lg">
          <h3 className="font-semibold text-lg text-text">Bestätigung erforderlich</h3>
          <p className="text-sm text-text">
            Bist du sicher, dass alles erledigt wurde und die Checkliste abgeschlossen werden kann?
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              onClick={() => setShowConfirmArchive(false)}
              variant="secondary"
              disabled={loading}
            >
              Nein, zurück
            </Button>
            <Button
              onClick={() => void handleConfirmArchive()}
              disabled={loading}
            >
              {loading ? 'Archiviert...' : 'Ja, archivieren'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
