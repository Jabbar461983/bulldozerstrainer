import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { fetchTrainers, deleteTrainer } from './api';
import type { TrainerRow } from './api';
import { fetchTeamOptions } from '../../lib/teams';
import type { TeamOption } from '../../lib/teams';
import { CreateTrainerDialog } from './CreateTrainerDialog';
import { EditTrainerDialog } from './EditTrainerDialog';
import { ImportTrainersDialog } from './ImportTrainersDialog';

export function CoachesPage() {
  const [trainers, setTrainers] = useState<TrainerRow[] | null>(null);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<TrainerRow | null>(null);

  async function load() {
    setError(null);
    try {
      const [trainerRows, teams] = await Promise.all([fetchTrainers(), fetchTeamOptions()]);
      setTrainers(trainerRows);
      setTeamOptions(teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trainer konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleDelete(trainer: TrainerRow) {
    const confirmed = window.confirm(
      `${trainer.first_name} ${trainer.last_name} wirklich unwiderruflich löschen?`,
    );
    if (!confirmed) return;
    setBusyId(trainer.id);
    setError(null);
    try {
      await deleteTrainer(trainer.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trainer konnte nicht gelöscht werden.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">Trainer</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowImport(true)}>
            CSV-Import
          </Button>
          <Button onClick={() => setShowCreate(true)}>+ Neuer Trainer</Button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      {trainers === null && <p className="text-sm text-text-muted">Lädt…</p>}
      {trainers?.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Noch keine Trainer angelegt.</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {trainers?.map((trainer) => (
          <Card key={trainer.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-text">
                  {trainer.first_name} {trainer.last_name}
                </p>
                {trainer.birthdate && (
                  <p className="text-sm text-text-muted">
                    Geburtsdatum: {new Date(trainer.birthdate).toLocaleDateString('de-CH')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {trainer.teams.length === 0 && (
                <span className="text-xs text-text-muted">Keinem Team zugewiesen</span>
              )}
              {trainer.teams.map((t) => (
                <span key={t.teamId} className="rounded-full bg-surface-alt px-2.5 py-1 text-xs text-text-muted">
                  {t.categoryName} · {t.teamName}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setEditingTrainer(trainer)}>
                Bearbeiten
              </Button>
              <Button variant="danger" disabled={busyId === trainer.id} onClick={() => void handleDelete(trainer)}>
                Löschen
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {showCreate && (
        <CreateTrainerDialog
          teamOptions={teamOptions}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}

      {showImport && (
        <ImportTrainersDialog
          teamOptions={teamOptions}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            void load();
          }}
        />
      )}

      {editingTrainer && (
        <EditTrainerDialog
          trainer={editingTrainer}
          teamOptions={teamOptions}
          onClose={() => setEditingTrainer(null)}
          onSaved={() => {
            setEditingTrainer(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
