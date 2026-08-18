import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute, ModuleRoute, AdminRoute } from './auth/ProtectedRoute';
import { LoginPage } from './auth/LoginPage';
import { RequestPasswordResetPage } from './auth/RequestPasswordResetPage';
import { ResetPasswordPage } from './auth/ResetPasswordPage';
import { AppLayout } from './layout/AppLayout';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { TeamsPage } from './features/teams/TeamsPage';
import { UsersPage } from './features/users/UsersPage';
import { PlayersPage } from './features/players/PlayersPage';
import { CoachesPage } from './features/coaches/CoachesPage';
import { ExercisesPage } from './features/exercises/ExercisesPage';
import { TrainingsPage } from './features/trainings/TrainingsPage';
import { GamesPage } from './features/games/GamesPage';
import { FinancePage } from './features/finance/FinancePage';
import { FinanceOverviewPage } from './features/finance/FinanceOverviewPage';
import { SeasonPlanningWrapper } from './features/seasonplanning/SeasonPlanningWrapper';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PwaUpdatePrompt />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/passwort-vergessen" element={<RequestPasswordResetPage />} />
          <Route path="/passwort-zuruecksetzen" element={<ResetPasswordPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route
              path="training"
              element={
                <ModuleRoute module="training">
                  <TrainingsPage />
                </ModuleRoute>
              }
            />
            <Route
              path="saisonplanung"
              element={
                <ModuleRoute module="training">
                  <SeasonPlanningWrapper />
                </ModuleRoute>
              }
            />
            <Route
              path="spiele"
              element={
                <ModuleRoute module="spiele">
                  <GamesPage />
                </ModuleRoute>
              }
            />
            <Route
              path="spieler"
              element={
                <ModuleRoute module="spieler">
                  <PlayersPage />
                </ModuleRoute>
              }
            />
            <Route
              path="trainer"
              element={
                <AdminRoute>
                  <CoachesPage />
                </AdminRoute>
              }
            />
            <Route
              path="uebungen"
              element={
                <ModuleRoute module="uebungen">
                  <ExercisesPage />
                </ModuleRoute>
              }
            />
            <Route
              path="finanzen"
              element={
                <ModuleRoute module="finanzen">
                  <FinancePage />
                </ModuleRoute>
              }
            />
            <Route
              path="finanzen/uebersicht"
              element={
                <AdminRoute>
                  <FinanceOverviewPage />
                </AdminRoute>
              }
            />
            <Route
              path="teams"
              element={
                <AdminRoute>
                  <TeamsPage />
                </AdminRoute>
              }
            />
            <Route
              path="benutzer"
              element={
                <AdminRoute>
                  <UsersPage />
                </AdminRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
