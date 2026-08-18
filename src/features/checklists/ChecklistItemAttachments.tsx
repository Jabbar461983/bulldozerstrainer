import { useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import { fetchChecklistItemAttachments, uploadChecklistItemAttachment, deleteChecklistItemAttachment } from './api';

interface ChecklistItemAttachmentsProps {
  itemId: string;
  instanceId: string | null;
  isCompleted: boolean;
}

interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: string;
}

export function ChecklistItemAttachments({
  itemId,
  instanceId,
  isCompleted,
}: ChecklistItemAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAttachments, setShowAttachments] = useState(false);

  useEffect(() => {
    async function loadAttachments() {
      try {
        const data = await fetchChecklistItemAttachments(itemId, instanceId ?? undefined);
        setAttachments(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Dateien');
      }
    }
    if (showAttachments) {
      loadAttachments();
    }
  }, [itemId, instanceId, showAttachments]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      await uploadChecklistItemAttachment(itemId, instanceId, file);
      const data = await fetchChecklistItemAttachments(itemId, instanceId ?? undefined);
      setAttachments(data);
      e.currentTarget.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Datei konnte nicht hochgeladen werden');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(attachmentId: string) {
    if (!confirm('Datei wirklich löschen?')) return;
    try {
      await deleteChecklistItemAttachment(attachmentId);
      setAttachments(attachments.filter((a) => a.id !== attachmentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Datei konnte nicht gelöscht werden');
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setShowAttachments(!showAttachments)}
        className="text-xs font-medium text-accent hover:underline cursor-pointer flex items-center gap-1"
      >
        📎 {attachments.length} {attachments.length === 1 ? 'Datei' : 'Dateien'}
      </button>

      {showAttachments && (
        <Card className="space-y-2 ml-4 p-3 bg-surface-alt text-sm">
          {error && <p className="text-xs text-error">{error}</p>}

          {attachments.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between gap-2 p-1 bg-surface rounded text-xs">
                  <a
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline flex-1 truncate"
                    title={att.fileName}
                  >
                    {att.fileName}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(att.id)}
                    className="text-error hover:font-bold"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {isCompleted && (
            <div className="border-t border-border pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium hover:bg-surface p-1 rounded">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx"
                />
                📤 {uploading ? 'Lädt...' : 'Datei hinzufügen'}
              </label>
              <p className="text-xs text-text-muted mt-1">Bilder, PDF, Word-Dateien</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
