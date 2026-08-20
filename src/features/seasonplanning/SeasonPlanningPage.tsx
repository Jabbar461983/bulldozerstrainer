import { useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import type { SeasonPlanningEvent, SeasonPlanningCategory } from '../../types/database';
import { useSeasonPlanningEventsByDateRange } from './useSeasonPlanning';
import { SeasonPlanningDialog } from './SeasonPlanningDialog';
import { SeasonPlanningCalendar } from './SeasonPlanningCalendar';
import { createSeasonPlanningEventsFromGames, deleteSeasonPlanningEvent } from './api';
import { useAuth } from '../../auth/AuthContext';

interface SeasonPlanningPageProps {
  teamId: string;
  season: string;
  teamName?: string;
}

const CATEGORY_NAMES: Record<SeasonPlanningCategory, string> = {
  activities: 'Aktivitäten',
  technique: 'Technik',
  tactics: 'Taktik',
  physical: 'Physis',
};

const CATEGORY_COLORS: Record<SeasonPlanningCategory, string> = {
  activities: 'bg-red-100 border-red-300 text-red-900',
  technique: 'bg-blue-100 border-blue-300 text-blue-900',
  tactics: 'bg-red-100 border-red-300 text-red-900',
  physical: 'bg-green-100 border-green-300 text-green-900',
};

export function SeasonPlanningPage({ teamId, season, teamName }: SeasonPlanningPageProps) {
  const { events, loading, error, refresh } = useSeasonPlanningEventsByDateRange(teamId, season);
  const { isAdmin } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SeasonPlanningEvent | null>(null);
  const [importingGames, setImportingGames] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [deletingActivities, setDeletingActivities] = useState(false);

  const handleEdit = (event: SeasonPlanningEvent) => {
    setEditingEvent(event);
    setShowDialog(true);
  };

  const handleCloseDialog = async () => {
    setShowDialog(false);
    setEditingEvent(null);
    // Reload events after creating/editing
    await refresh();
  };

  const handleImportGames = async () => {
    setImportingGames(true);
    try {
      await createSeasonPlanningEventsFromGames(teamId, season);
      await refresh();
    } catch (err) {
      console.error('Failed to import games:', err);
    } finally {
      setImportingGames(false);
    }
  };

  const handleToggleActivitySelection = (eventId: string) => {
    const newSelected = new Set(selectedActivities);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedActivities(newSelected);
  };

  const handleDeleteSelectedActivities = async () => {
    if (selectedActivities.size === 0) return;

    setDeletingActivities(true);
    try {
      for (const eventId of selectedActivities) {
        await deleteSeasonPlanningEvent(eventId);
      }
      setSelectedActivities(new Set());
      await refresh();
    } catch (err) {
      console.error('Failed to delete activities:', err);
    } finally {
      setDeletingActivities(false);
    }
  };
  if (loading) {
    return <div className="p-6 text-text-muted">Lädt...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">Fehler: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Saisonplanung {season}</h1>
        <div className="flex gap-2">
          {isAdmin && (
            <Button onClick={handleImportGames} disabled={importingGames} variant="secondary">
              {importingGames ? 'Importiert...' : '🎮 Spiele importieren'}
            </Button>
          )}
          <Button onClick={() => setShowDialog(true)}>Aktivität hinzufügen</Button>
        </div>
      </div>

      <SeasonPlanningCalendar
        events={events}
        season={season}
        teamName={teamName}
        onEditEvent={handleEdit}
        categoryColors={CATEGORY_COLORS}
        categoryNames={CATEGORY_NAMES}
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Übersicht</h2>
          {isAdmin && selectedActivities.size > 0 && (
            <Button
              onClick={handleDeleteSelectedActivities}
              disabled={deletingActivities}
              variant="secondary"
              className="bg-red-100 border-red-300 text-red-900 hover:bg-red-200"
            >
              {deletingActivities ? 'Löscht...' : `Löschen (${selectedActivities.size})`}
            </Button>
          )}
        </div>
        {Object.entries(CATEGORY_NAMES).map(([category, label]) => {
          const categoryEvents = events.filter((e) => e.category === category);
          return (
            <Card key={category}>
              <h3 className="font-medium text-text">{label}</h3>
              <div className="mt-2 space-y-2">
                {categoryEvents.length === 0 ? (
                  <p className="text-sm text-text-muted">Keine Einträge</p>
                ) : (
                  categoryEvents.map((event) => (
                    <div key={event.id} className="flex items-start justify-between gap-2 text-sm">
                      <div className="flex items-start gap-2 flex-1">
                        {isAdmin && (
                          <input
                            type="checkbox"
                            checked={selectedActivities.has(event.id)}
                            onChange={() => handleToggleActivitySelection(event.id)}
                            className="mt-0.5"
                          />
                        )}
                        <div>
                          <p className="font-medium text-text">{event.title}</p>
                          {event.subcategory && <p className="text-text-muted">{event.subcategory}</p>}
                          <p className="text-xs text-text-muted">
                            {new Date(event.start_date).toLocaleDateString('de-CH')} -{' '}
                            {new Date(event.end_date).toLocaleDateString('de-CH')}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" onClick={() => handleEdit(event)}>
                        Bearbeiten
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {showDialog && (
        <SeasonPlanningDialog
          teamId={teamId}
          editingEvent={editingEvent}
          onClose={handleCloseDialog}
        />
      )}
    </div>
  );
}
