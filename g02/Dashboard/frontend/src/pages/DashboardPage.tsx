import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { DashboardDataContent } from '../components/dashboard/DashboardDataContent';
import { DatasetsLineageContent } from '../components/dashboard/DatasetsLineageContent';
import { DatasetsSnapshotsContent } from '../components/dashboard/DatasetsSnapshotsContent';
import { DatasetsSourcesContent } from '../components/dashboard/DatasetsSourcesContent';
import { ForecastsBacktestsContent } from '../components/dashboard/ForecastsBacktestsContent';
import { ForecastsOverviewContent } from '../components/dashboard/ForecastsOverviewContent';
import { ForecastsScenariosContent } from '../components/dashboard/ForecastsScenariosContent';
import { ModelExplainabilityContent } from '../components/dashboard/ModelExplainabilityContent';
import { ModelRegistryContent } from '../components/dashboard/ModelRegistryContent';
import { ProfileContent } from '../components/dashboard/ProfileContent';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { ApiConfigurationError, ApiError } from '../services/api-client';
import type { AuthApiService, AuthenticatedApiUser } from '../services/auth-api.service';
import type { DashboardApiService } from '../services/dashboard.service';
import { Button } from '@/components/ui/button';

type DashboardView =
  | 'dashboard'
  | 'models'
  | 'model-registry'
  | 'forecasts-overview'
  | 'forecasts-backtests'
  | 'forecasts-scenarios'
  | 'datasets-sources'
  | 'datasets-snapshots'
  | 'datasets-lineage'
  | 'profile';

interface DashboardPageProps {
  authApiService: AuthApiService;
  dashboardApiService: DashboardApiService;
  view?: DashboardView;
}

interface ViewMeta {
  location:
    | 'Dashboard'
    | 'Models'
    | 'Model registry'
    | 'Forecasts'
    | 'Backtests'
    | 'Scenarios'
    | 'Datasets'
    | 'Snapshots'
    | 'Lineage'
    | 'Profile';
  overline: string;
  title: string;
  description: string;
}

const viewMeta: Record<DashboardView, ViewMeta> = {
  dashboard: {
    location: 'Dashboard',
    overline: 'Demand intelligence',
    title: 'Dashboard',
    description: 'Review the current demand forecast across operators, treatment lines, and regions.',
  },
  models: {
    location: 'Models',
    overline: 'Model intelligence',
    title: 'Model explainability',
    description: 'Understand how the Random Forest uses recent demand to produce its forecasts.',
  },
  'model-registry': {
    location: 'Model registry',
    overline: 'Model intelligence',
    title: 'Model registry',
    description: 'Compare every evaluated candidate on shared validation folds and the holdout.',
  },
  'forecasts-overview': {
    location: 'Forecasts',
    overline: 'Forecast intelligence',
    title: 'Forecast overview',
    description: 'Estimated demand by forecast month across the current prediction base.',
  },
  'forecasts-backtests': {
    location: 'Backtests',
    overline: 'Forecast intelligence',
    title: 'Backtests',
    description: 'Compare predicted and observed demand volume on the holdout.',
  },
  'forecasts-scenarios': {
    location: 'Scenarios',
    overline: 'Forecast intelligence',
    title: 'Scenarios',
    description: 'Explore adjusted estimated demand with what-if multipliers.',
  },
  'datasets-sources': {
    location: 'Datasets',
    overline: 'Data lineage',
    title: 'Dataset sources',
    description: 'The documented pipeline artifacts, their provenance and sensitivity.',
  },
  'datasets-snapshots': {
    location: 'Snapshots',
    overline: 'Data lineage',
    title: 'Snapshots',
    description: 'Materialized versions with row, column and period coverage.',
  },
  'datasets-lineage': {
    location: 'Lineage',
    overline: 'Data lineage',
    title: 'Lineage',
    description: 'How each artifact is derived from the ones before it.',
  },
  profile: {
    location: 'Profile',
    overline: 'Your account',
    title: 'Profile',
    description: 'Review your account details and manage your sign-in password.',
  },
};

const expiredSessionMessage = 'Your session expired. Please sign in again.';

export function DashboardPage({ authApiService, dashboardApiService, view = 'dashboard' }: DashboardPageProps) {
  useDocumentTitle(`${viewMeta[view].title} · ShokAI`);
  const { invalidateSession, refreshSession, session, signOut, user } = useAuth();
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthenticatedApiUser | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isRequestLoading, setIsRequestLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const signOutInFlight = useRef(false);
  const dashboardUnauthorizedInFlight = useRef(false);
  const dashboardRefreshAttempted = useRef(false);

  useEffect(() => {
    if (!session) return;

    let active = true;

    async function rejectInvalidSession() {
      if (active) await invalidateSession(expiredSessionMessage);
    }

    async function verifyAccessToken(accessToken: string, allowRefresh: boolean): Promise<void> {
      try {
        const currentUser = await authApiService.getCurrentUser(accessToken);
        if (active) setAuthenticatedUser(currentUser);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          if (allowRefresh) {
            try {
              const refreshedSession = await refreshSession();

              if (!active) return;
              if (refreshedSession) {
                await verifyAccessToken(refreshedSession.access_token, false);
                return;
              }
            } catch {
              // A failed refresh is handled as an invalid session below.
            }
          }

          await rejectInvalidSession();
          return;
        }

        if (!active) return;
        setRequestError(
          error instanceof ApiConfigurationError
            ? 'The dashboard connection is not configured. Contact an administrator.'
            : 'We could not reach the dashboard service. Check your connection and try again.',
        );
      } finally {
        if (active) setIsRequestLoading(false);
      }
    }

    setAuthenticatedUser(null);
    setRequestError(null);
    setIsRequestLoading(true);
    void verifyAccessToken(session.access_token, true);

    return () => {
      active = false;
    };
  }, [authApiService, invalidateSession, refreshSession, retryCount]);

  const handleRetry = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  const handleDashboardUnauthorized = useCallback(() => {
    if (dashboardUnauthorizedInFlight.current) return;
    dashboardUnauthorizedInFlight.current = true;

    void (async () => {
      if (!dashboardRefreshAttempted.current) {
        dashboardRefreshAttempted.current = true;

        try {
          const refreshedSession = await refreshSession();
          if (refreshedSession) return;
        } catch {
          // A failed refresh is handled as an invalid session below.
        }
      }

      await invalidateSession(expiredSessionMessage);
    })().finally(() => {
      dashboardUnauthorizedInFlight.current = false;
    });
  }, [invalidateSession, refreshSession]);

  async function handleSignOut() {
    if (signOutInFlight.current) return;

    signOutInFlight.current = true;
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      await signOut();
    } catch {
      setSignOutError('We could not sign you out. Please try again.');
    } finally {
      signOutInFlight.current = false;
      setIsSigningOut(false);
    }
  }

  const displayEmail = authenticatedUser?.email ?? user?.email ?? 'E-mail unavailable';

  return (
    <DashboardLayout
      email={displayEmail}
      isSigningOut={isSigningOut}
      locationLabel={viewMeta[view].location}
      onSignOut={() => void handleSignOut()}
      signOutError={signOutError}
    >
      <section
        key={view}
        className="mx-auto grid max-w-[1240px] animate-fade-up gap-6"
        aria-labelledby="dashboard-title"
      >
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="grid gap-2">
            <span className="inline-flex items-center gap-2 text-[0.75rem] font-medium text-ocean-600">
              <span className="h-px w-6 bg-ocean-400" aria-hidden="true" />
              {viewMeta[view].overline}
            </span>
            <h1
              id="dashboard-title"
              className="font-heading text-[clamp(2rem,3.4vw,2.5rem)] leading-none font-extrabold tracking-[-0.035em] text-navy"
            >
              {viewMeta[view].title}
            </h1>
            <p className="max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
              {viewMeta[view].description}
            </p>
          </div>
        </div>

        {isRequestLoading ? (
          <div
            className="min-h-22 rounded-2xl border border-border bg-white/70 p-6 text-muted-foreground"
            role="status"
            aria-busy="true"
          >
            Verifying secure session…
          </div>
        ) : null}

        {requestError ? (
          <div
            className="grid w-full max-w-[480px] gap-3 rounded-xl border border-danger-border bg-danger-surface p-4 text-left text-[0.8125rem] text-danger"
            role="alert"
          >
            <p>{requestError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="w-fit border-current text-danger hover:bg-card hover:text-danger"
            >
              Try again
            </Button>
          </div>
        ) : null}

        {authenticatedUser && session ? (
          <>
            <span className="sr-only">Secure session verified.</span>
            {view === 'profile' ? (
              <ProfileContent />
            ) : view === 'models' ? (
              <ModelExplainabilityContent
                accessToken={session.access_token}
                onUnauthorized={handleDashboardUnauthorized}
                service={dashboardApiService}
              />
            ) : view === 'model-registry' ? (
              <ModelRegistryContent
                accessToken={session.access_token}
                onUnauthorized={handleDashboardUnauthorized}
                service={dashboardApiService}
              />
            ) : view === 'forecasts-overview' ? (
              <ForecastsOverviewContent
                accessToken={session.access_token}
                onUnauthorized={handleDashboardUnauthorized}
                service={dashboardApiService}
              />
            ) : view === 'forecasts-backtests' ? (
              <ForecastsBacktestsContent
                accessToken={session.access_token}
                onUnauthorized={handleDashboardUnauthorized}
                service={dashboardApiService}
              />
            ) : view === 'forecasts-scenarios' ? (
              <ForecastsScenariosContent
                accessToken={session.access_token}
                onUnauthorized={handleDashboardUnauthorized}
                service={dashboardApiService}
              />
            ) : view === 'datasets-sources' ? (
              <DatasetsSourcesContent
                accessToken={session.access_token}
                onUnauthorized={handleDashboardUnauthorized}
                service={dashboardApiService}
              />
            ) : view === 'datasets-snapshots' ? (
              <DatasetsSnapshotsContent
                accessToken={session.access_token}
                onUnauthorized={handleDashboardUnauthorized}
                service={dashboardApiService}
              />
            ) : view === 'datasets-lineage' ? (
              <DatasetsLineageContent
                accessToken={session.access_token}
                onUnauthorized={handleDashboardUnauthorized}
                service={dashboardApiService}
              />
            ) : (
              <DashboardDataContent
                accessToken={session.access_token}
                onUnauthorized={handleDashboardUnauthorized}
                service={dashboardApiService}
              />
            )}
          </>
        ) : null}
      </section>
    </DashboardLayout>
  );
}
