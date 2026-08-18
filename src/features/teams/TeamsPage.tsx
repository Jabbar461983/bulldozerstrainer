import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { OfflineNotice } from '../../components/OfflineNotice';
import { fetchCategories, fetchTeams, fetchAssignableUsers, deleteCategory, deleteTeam } from './api';
import type { AssignableUser, TeamRow } from './api';
import type { Category } from '../../types/database';
import { ROLE_LABELS } from '../../auth/permissions';
import { withCache } from '../../lib/withCache';
import { CreateCategoryDialog } from './CreateCategoryDialog';
import { EditCategoryDialog } from './EditCategoryDialog';
import { CreateTeamDialog } from './CreateTeamDialog';
import { EditTeamDialog } from './EditTeamDialog';

export function TeamsPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [offlineCachedAt, setOfflineCachedAt] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [creatingTeamFor, setCreatingTeamFor] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null);

  async function load() {
    setError(null);
    try {
      const result = await withCache('teams-page', async () => {
        const [categoryRows, teamRows, userRows] = await Promise.all([
          fetchCategories(),
          fetchTeams(),
          fetchAssignableUsers(),
        ]);
        return { categoryRows, teamRows, userRows };
      });
      setCategories(result.data.categoryRows);
      setTeams(result.data.teamRows);
      setUsers(result.data.userRows);
      setOfflineCachedAt(result.fromCache ? result.cachedAt : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Daten konnten nicht geladen werden.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleDeleteCategory(category: Category) {
    const confirmed = window.confirm(`Kategorie „${category.name}“ wirklich löschen?`);
    if (!confirmed) return;
    setBusyId(category.id);
    setError(null);
    try {
      await deleteCategory(category.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kategorie konnte nicht gelöscht werden.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteTeam(team: TeamRow) {
    const confirmed = window.confirm(`Team „${team.name}“ (${team.season}) wirklich löschen?`);
    if (!confirmed) return;
    setBusyId(team.id);
    setError(null);
    try {
      await deleteTeam(team.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Team konnte nicht gelöscht werden.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">Teamverwaltung</h1>
        <Button onClick={() => setShowCreateCategory(true)}>+ Neue Kategorie</Button>
      </div>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {offlineCachedAt && <OfflineNotice cachedAt={offlineCachedAt} />}

      {categories === null && <p className="text-sm text-text-muted">Lädt…</p>}
      {categories?.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Noch keine Alterskategorien angelegt.</p>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {categories?.map((category) => {
          const categoryTeams = teams
            .filter((t) => t.category_id === category.id)
            .sort((a, b) => b.season.localeCompare(a.season) || a.name.localeCompare(b.name));

          return (
            <Card key={category.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-text">{category.name}</p>
                  {category.is_default && (
                    <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                      Standard
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setEditingCategory(category)}>
                    Bearbeiten
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busyId === category.id}
                    onClick={() => void handleDeleteCategory(category)}
                  >
                    Löschen
                  </Button>
                </div>
              </div>

              {categoryTeams.length === 0 && (
                <p className="text-sm text-text-muted">Noch keine Teams in dieser Kategorie.</p>
              )}

              <div className="flex flex-col gap-2">
                {categoryTeams.map((team) => (
                  <div key={team.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-text">
                          {team.name} <span className="text-text-muted">· {team.season}</span>
                        </p>
                        <p className="text-sm text-text-muted">
                          Standard-Trainingsdauer: {team.default_training_duration_minutes} Min.
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {team.coachAssignments.length === 0 && (
                        <span className="text-xs text-text-muted">Kein Trainer zugewiesen</span>
                      )}
                      {team.coachAssignments.map((a) => (
                        <span
                          key={a.userId + a.role}
                          className="rounded-full bg-surface-alt px-2.5 py-1 text-xs text-text-muted"
                        >
                          {a.firstName} {a.lastName} – {ROLE_LABELS[a.role]}
                          {a.role !== 'finance' && a.financeAccess && ' · Finanzen'}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => setEditingTeam(team)}>
                        Bearbeiten
                      </Button>
                      <Button
                        variant="danger"
                        disabled={busyId === team.id}
                        onClick={() => void handleDeleteTeam(team)}
                      >
                        Löschen
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="secondary" className="self-start" onClick={() => setCreatingTeamFor(category.id)}>
                + Neues Team
              </Button>
            </Card>
          );
        })}
      </div>

      {showCreateCategory && (
        <CreateCategoryDialog
          nextSortOrder={(categories?.length ?? 0) + 1}
          onClose={() => setShowCreateCategory(false)}
          onCreated={() => {
            setShowCreateCategory(false);
            void load();
          }}
        />
      )}

      {editingCategory && (
        <EditCategoryDialog
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSaved={() => {
            setEditingCategory(null);
            void load();
          }}
        />
      )}

      {creatingTeamFor && categories && (
        <CreateTeamDialog
          categories={categories}
          users={users}
          defaultCategoryId={creatingTeamFor}
          onClose={() => setCreatingTeamFor(null)}
          onCreated={() => {
            setCreatingTeamFor(null);
            void load();
          }}
        />
      )}

      {editingTeam && categories && (
        <EditTeamDialog
          team={editingTeam}
          categories={categories}
          users={users}
          onClose={() => setEditingTeam(null)}
          onSaved={() => {
            setEditingTeam(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
