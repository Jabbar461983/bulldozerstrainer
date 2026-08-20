import { useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import { fetchChecklistItemAttachments } from './api';

interface ChecklistItemAttachmentsProps {
  itemId: string;
}

interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: string;
}

export function ChecklistItemAttachments({ itemId }: ChecklistItemAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAttachments, setShowAttachments] = useState(false);

  useEffect(() => {
    async function loadAttachments() {
      try {
        const data = await fetchChecklistItemAttachments(itemId);
        setAttachments(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Dateien');
      }
    }
    if (showAttachments) {
      loadAttachments();
    }
  }, [itemId, showAttachments]);

  if (attachments.length === 0) {
    return null;
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
                <div key={att.id} className="flex items-center gap-2 p-1 bg-surface rounded text-xs">
                  <a
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline flex-1 truncate"
                    title={att.fileName}
                  >
                    {att.fileName}
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
