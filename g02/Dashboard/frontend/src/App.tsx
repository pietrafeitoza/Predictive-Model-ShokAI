import type { PropsWithChildren } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import {
  authApiService as defaultAuthApiService,
  type AuthApiService,
} from './services/auth-api.service';
import { authService as defaultAuthService, type AuthService } from './services/auth.service';
import {
  dashboardApiService as defaultDashboardApiService,
  type DashboardApiService,
} from './services/dashboard.service';

interface AppProps {
  authApiService?: AuthApiService;
  authService?: AuthService;
  dashboardApiService?: DashboardApiService;
}

export function App({
  authApiService = defaultAuthApiService,
  authService = defaultAuthService,
  dashboardApiService = defaultDashboardApiService,
}: AppProps = {}) {
  return (
    <BrowserRouter>
      <AuthProvider service={authService}>
        <ApplicationRoutes
          authApiService={authApiService}
          dashboardApiService={dashboardApiService}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export function ApplicationRoutes({
  authApiService,
  dashboardApiService,
}: {
  authApiService: AuthApiService;
  dashboardApiService: DashboardApiService;
}) {
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return <SessionLoading />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestRoute>
            <AuthPage />
          </GuestRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage
              authApiService={authApiService}
              dashboardApiService={dashboardApiService}
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/models"
        element={
          <ProtectedRoute>
            <DashboardPage
              authApiService={authApiService}
              dashboardApiService={dashboardApiService}
              view="models"
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/models/registry"
        element={
          <ProtectedRoute>
            <DashboardPage
              authApiService={authApiService}
              dashboardApiService={dashboardApiService}
              view="model-registry"
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/forecasts"
        element={
          <ProtectedRoute>
            <DashboardPage
              authApiService={authApiService}
              dashboardApiService={dashboardApiService}
              view="forecasts-overview"
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/forecasts"
        element={
          <ProtectedRoute>
            <DashboardPage
              authApiService={authApiService}
              dashboardApiService={dashboardApiService}
              view="forecasts-overview"
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/forecasts/backtests"
        element={
          <ProtectedRoute>
            <DashboardPage
              authApiService={authApiService}
              dashboardApiService={dashboardApiService}
              view="forecasts-backtests"
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/forecasts/scenarios"
        element={
          <ProtectedRoute>
            <DashboardPage
              authApiService={authApiService}
              dashboardApiService={dashboardApiService}
              view="forecasts-scenarios"
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/datasets"
        element={
          <ProtectedRoute>
            <DashboardPage
              authApiService={authApiService}
              dashboardApiService={dashboardApiService}
              view="datasets-sources"
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/datasets/snapshots"
        element={
          <ProtectedRoute>
            <DashboardPage
              authApiService={authApiService}
              dashboardApiService={dashboardApiService}
              view="datasets-snapshots"
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/datasets/lineage"
        element={
          <ProtectedRoute>
            <DashboardPage
              authApiService={authApiService}
              dashboardApiService={dashboardApiService}
              view="datasets-lineage"
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/profile"
        element={
          <ProtectedRoute>
            <DashboardPage
              authApiService={authApiService}
              dashboardApiService={dashboardApiService}
              view="profile"
            />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate replace to={session ? '/dashboard' : '/login'} />} />
    </Routes>
  );
}

function ProtectedRoute({ children }: PropsWithChildren) {
  const { session } = useAuth();
  return session ? children : <Navigate replace to="/login" />;
}

function GuestRoute({ children }: PropsWithChildren) {
  const { session } = useAuth();
  return session ? <Navigate replace to="/dashboard" /> : children;
}

function SessionLoading() {
  return (
    <main
      className="grid min-h-screen place-content-center justify-items-center gap-4 bg-paper p-8 text-sm text-muted-foreground"
      aria-live="polite"
    >
      <img src="/assets/shokai-icon-black.svg" alt="ShokAI" className="w-11" />
      <span>Loading your workspace…</span>
    </main>
  );
}
