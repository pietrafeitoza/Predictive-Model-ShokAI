import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '@supabase/supabase-js';
import type { DatasetCatalog, ModelRegistryEntry } from '@shokai/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { ApiError } from './services/api-client';
import type { AuthApiService } from './services/auth-api.service';
import type { AuthService } from './services/auth.service';
import type { DashboardApiService } from './services/dashboard.service';

const session = {
  access_token: 'persisted-access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  expires_at: 1_800_000_000,
  token_type: 'bearer',
  user: { id: 'user-123', email: 'supabase@example.com' },
} as Session;

function createAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    getSession: vi.fn().mockResolvedValue(null),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
    refreshSession: vi.fn().mockResolvedValue(null),
    signIn: vi.fn().mockResolvedValue(session),
    signUp: vi.fn().mockResolvedValue({ session: null, needsEmailConfirmation: true }),
    signOut: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createAuthApiService(overrides: Partial<AuthApiService> = {}): AuthApiService {
  return {
    getCurrentUser: vi.fn().mockResolvedValue({
      id: 'user-123',
      email: 'backend@example.com',
    }),
    ...overrides,
  };
}

function createDashboardApiService(): DashboardApiService {
  const meta = {
    source: 'mock' as const,
    generatedAt: '2026-09-10T12:30:00.000Z',
    modelId: null,
    modelVersion: null,
  };

  return {
    getDistribution: vi.fn().mockResolvedValue({ data: [], meta }),
    getFilterOptions: vi.fn().mockResolvedValue({
      data: {
        operators: [],
        treatmentLines: [],
        providerStates: [],
        forecastMonths: [],
        opportunityTiers: [],
      },
      meta,
    }),
    getPredictions: vi.fn().mockResolvedValue({ data: [], meta }),
    getSelectedModel: vi.fn().mockResolvedValue({ data: null, meta }),
    getModelExplainability: vi.fn().mockResolvedValue({ data: null, meta }),
    getModelRegistry: vi.fn().mockResolvedValue({ data: [], meta }),
    setModelStatus: vi.fn().mockResolvedValue({ data: [], meta }),
    getDatasetCatalog: vi.fn().mockResolvedValue({ data: { sources: [], lineage: [] }, meta }),
    getBacktest: vi.fn().mockResolvedValue({
      data: {
        rowCount: 0,
        observedRowCount: 0,
        predictedTotal: 0,
        observedTotal: 0,
        mae: null,
        rmse: null,
        r2: null,
        byForecastMonth: [],
        byTreatmentLine: [],
        byProviderState: [],
      },
      meta,
    }),
    getSummary: vi.fn().mockResolvedValue({
      data: {
        totalEstimatedDemandVolume: 0,
        predictionCount: 0,
        operatorCount: 0,
        highOpportunityRecordCount: 0,
      },
      meta,
    }),
  };
}

function renderApp(
  path: string,
  authService = createAuthService(),
  authApiService = createAuthApiService(),
  dashboardApiService = createDashboardApiService(),
) {
  window.history.pushState({}, '', path);
  render(
    <App
      authService={authService}
      authApiService={authApiService}
      dashboardApiService={dashboardApiService}
    />,
  );
  return { authApiService, authService };
}

describe('authenticated application routing', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('redirects unauthenticated dashboard access to login', async () => {
    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(document.title).toBe('Sign in · ShokAI');
  });

  it('opens the profile page from the account menu', async () => {
    renderApp(
      '/dashboard',
      createAuthService({ getSession: vi.fn().mockResolvedValue(session) }),
    );

    const trigger = await screen.findByRole('button', {
      name: 'Account menu for backend@example.com',
    });

    // jsdom has no PointerEvent, so fireEvent.pointerDown loses `button`/`ctrlKey`
    // and Radix never opens. Dispatch a real MouseEvent instead. user-event's
    // async act wrapper makes the Radix/floating-ui open loop take seconds.
    fireEvent(
      trigger,
      new MouseEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        ctrlKey: false,
      }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Profile' }));

    expect(screen.getByRole('heading', { name: 'Profile', level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard/profile');
    expect(screen.getByRole('heading', { name: 'supabase@example.com' })).toBeInTheDocument();
  });

  it('opens the protected Models view and renders the published analysis', async () => {
    const dashboardApiService = createDashboardApiService();
    vi.mocked(dashboardApiService.getModelExplainability).mockResolvedValue({
      meta: { source: 'mock', generatedAt: '2026-09-10T12:30:00.000Z', modelId: null, modelVersion: null },
      data: {
        modelId: 'north-region-mama-demand-random-forest',
        modelVersion: 'forest-v1',
        method: 'SHAP TreeExplainer',
        targetUnit: 'billed items per month',
        sampleSize: 1000,
        holdoutSize: 3810,
        expectedValue: 61.611,
        globalFigures: [
          { kind: 'dependence', title: 'How leading features act', imagePath: '/assets/model-explainability/dependence.png', alt: 'Three dependence plots', caption: 'Feature behavior.', panelAspectRatio: 886 / 713, panels: [{ label: 'Recent 3-month demand' }, { label: 'Recent 6-month demand' }, { label: 'Forecast month' }] },
          { kind: 'bar', title: 'Overall feature impact', imagePath: '/assets/model-explainability/bar.png', alt: 'SHAP bar plot', caption: 'Average impact.' },
          { kind: 'beeswarm', title: 'Direction and spread', imagePath: '/assets/model-explainability/beeswarm.png', alt: 'SHAP beeswarm', caption: 'Direction.' },
        ],
        features: [
          { name: 'DEMAND_MEAN_3M', meanAbsoluteShap: 46.7, sharePercent: 54.7 },
        ],
        localExamples: [{ title: 'Typical row', imagePath: '/assets/model-explainability/example.png', alt: 'SHAP waterfall', caption: 'Example.', context: 'Holdout row', observed: 5, predicted: 4.3 }],
        limitations: ['SHAP describes model behavior, not causation.'],
      },
    });
    renderApp('/dashboard/models', createAuthService({ getSession: vi.fn().mockResolvedValue(session) }), createAuthApiService(), dashboardApiService);

    expect(await screen.findByRole('heading', { name: 'Model explainability', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Overall feature impact' })).toBeInTheDocument();
    expect(screen.getAllByText('54.7%')).toHaveLength(2);
    expect(screen.getByText(/comes from the leading input\./)).toBeInTheDocument();
    expect(screen.getByText(/3,810-row holdout/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'ShokAI Dashboard' })).not.toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Explainability' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(/independent of the mock dashboard predictions/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Forecast month' }));
    expect(screen.getByRole('img', { name: 'SHAP dependence for forecast month' })).toBeInTheDocument();
    expect(dashboardApiService.getModelExplainability).toHaveBeenCalledWith('persisted-access-token');
  });

  it('opens the protected model registry and lists the evaluated candidates', async () => {
    const entry: ModelRegistryEntry = {
      modelId: 'north-region-mama-demand-random-forest',
      modelVersion: 'forest-v1',
      algorithm: 'random_forest',
      status: 'selected',
      role: 'provisional_challenger',
      description: 'Shipped prediction base.',
      selected: true,
      deployed: false,
      hasPredictionImport: true,
      selectionRank: 1,
      targetTechnicalName: 'volume_demanda_proxy',
      targetDisplayName: 'Estimated demand volume',
      targetUnit: 'billed item quantity',
      trainingPeriodStart: '2025-02',
      trainingPeriodEnd: '2025-09',
      holdoutPeriodStart: '2025-10',
      holdoutPeriodEnd: '2025-12',
      metricScope: 'all_holdout_rows',
      selectionCriterion: 'Lowest mean validation MAE.',
      hyperparameters: { n_estimators: 600 },
      featureList: ['DEMAND_LAG_1M'],
      caveats: ['Estimated billed-item utilization demand volume.'],
      generatedAt: '2026-09-25T00:00:00.000Z',
      metrics: [
        { split: 'validation', rowScope: 'all', metric: 'mae', value: 31.01, stdDev: 2.43 },
        { split: 'holdout', rowScope: 'all', metric: 'mae', value: 18.141, stdDev: null },
        { split: 'holdout', rowScope: 'all', metric: 'r2', value: 0.421, stdDev: null },
        { split: 'holdout', rowScope: 'observed', metric: 'skill', value: 0.211, stdDev: null },
      ],
      validationFolds: [
        {
          originMonth: '2025-07',
          fitStartMonth: '2025-02',
          fitEndMonth: '2025-06',
          fitRows: 4238,
          validationRows: 1086,
          validationZeroShare: 0.4052,
          naiveValidationMae: 37.4705,
        },
      ],
    };
    const dashboardApiService = createDashboardApiService();
    vi.mocked(dashboardApiService.getModelRegistry).mockResolvedValue({
      data: [entry],
      meta: {
        source: 'supabase',
        generatedAt: '2026-09-25T00:00:00.000Z',
        modelId: entry.modelId,
        modelVersion: entry.modelVersion,
      },
    });
    renderApp(
      '/dashboard/models/registry',
      createAuthService({ getSession: vi.fn().mockResolvedValue(session) }),
      createAuthApiService(),
      dashboardApiService,
    );

    expect(await screen.findByRole('heading', { name: 'Model registry', level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Model registry · ShokAI'));
    expect(await screen.findByRole('heading', { name: 'Random Forest · forest-v1' })).toBeInTheDocument();
    const registryNav = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(registryNav).getByRole('link', { name: 'Registry' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(dashboardApiService.getModelRegistry).toHaveBeenCalledWith('persisted-access-token');

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Compare Random Forest forest-v1' }),
    );
    expect(await screen.findByRole('heading', { name: 'Side-by-side comparison' })).toBeInTheDocument();
  });

  it('opens the protected Forecasts backtests view with observed metrics', async () => {
    const dashboardApiService = createDashboardApiService();
    vi.mocked(dashboardApiService.getBacktest).mockResolvedValue({
      data: {
        rowCount: 10,
        observedRowCount: 8,
        predictedTotal: 100,
        observedTotal: 110,
        mae: 4.5,
        rmse: 6.2,
        r2: 0.5,
        byForecastMonth: [
          {
            key: '2025-10',
            label: '2025-10',
            rowCount: 5,
            observedRowCount: 4,
            predictedTotal: 50,
            observedTotal: 55,
            mae: 4,
            rmse: 5,
            r2: 0.4,
          },
        ],
        byTreatmentLine: [],
        byProviderState: [],
      },
      meta: {
        source: 'supabase',
        generatedAt: '2026-09-25T00:00:00.000Z',
        modelId: null,
        modelVersion: null,
      },
    });
    renderApp(
      '/dashboard/forecasts/backtests',
      createAuthService({ getSession: vi.fn().mockResolvedValue(session) }),
      createAuthApiService(),
      dashboardApiService,
    );

    expect(await screen.findByRole('heading', { name: 'Backtests', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('4.50')).toBeInTheDocument();
    expect(screen.getByText('6.20')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(nav).getByRole('link', { name: 'Backtests' })).toHaveAttribute('aria-current', 'page');
    expect(dashboardApiService.getBacktest).toHaveBeenCalled();

    const user = userEvent.setup();
    await user.click(screen.getByText('2025-10'));
    await waitFor(() =>
      expect(window.location.search).toContain('forecastMonths=2025-10'),
    );
  });

  it('opens the protected Datasets lineage view from the catalog', async () => {
    const catalog: DatasetCatalog = {
      sources: [
        {
          key: 'north-region-mama-data-en',
          name: 'Treated breast-cancer base',
          kind: 'processed',
          provider: 'ANS / TISS',
          description: 'Cleaned event base.',
          sensitivity: 'internal',
          updateFrequency: 'annual',
          snapshots: [
            {
              version: '2025',
              checksum: null,
              storagePath: 'data/processed/x.parquet',
              rowCount: 310340,
              columnCount: 119,
              periodStart: '2025-01-01',
              periodEnd: '2025-12-31',
              status: 'available',
              generatedAt: '2026-09-25T00:00:00.000Z',
            },
          ],
          columns: [
            {
              name: 'ID_EVENTO_ATENCAO_SAUDE',
              dataType: 'text',
              classification: 'identifier',
              origin: 'ANS/TISS',
              description: null,
            },
          ],
        },
      ],
      lineage: [
        {
          upstreamKey: 'north-region-mama-data-en',
          upstreamVersion: '2025',
          downstreamKey: 'modeling-matrix-atuantes-v1',
          downstreamVersion: 'v1',
          relation: 'featurized_into',
          description: 'Panel target plus eight approved predictors.',
        },
      ],
    };
    const dashboardApiService = createDashboardApiService();
    vi.mocked(dashboardApiService.getDatasetCatalog).mockResolvedValue({
      data: catalog,
      meta: {
        source: 'supabase',
        generatedAt: '2026-09-25T00:00:00.000Z',
        modelId: null,
        modelVersion: null,
      },
    });
    renderApp(
      '/dashboard/datasets/lineage',
      createAuthService({ getSession: vi.fn().mockResolvedValue(session) }),
      createAuthApiService(),
      dashboardApiService,
    );

    expect(await screen.findByRole('heading', { name: 'Lineage', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Treated breast-cancer base')).toBeInTheDocument();
    expect(screen.getByText('featurized_into')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(nav).getByRole('link', { name: 'Lineage' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens the protected Forecasts overview with monthly aggregates', async () => {
    const dashboardApiService = createDashboardApiService();
    const supabaseMeta = {
      source: 'supabase' as const,
      generatedAt: '2026-09-25T00:00:00.000Z',
      modelId: null,
      modelVersion: null,
    };
    vi.mocked(dashboardApiService.getDistribution).mockImplementation((dimension) =>
      Promise.resolve({
        data:
          dimension === 'forecast_month'
            ? [
                {
                  key: '2025-10',
                  label: '2025-10',
                  estimatedDemandVolume: 279159.9,
                  predictionCount: 4974,
                },
              ]
            : [],
        meta: supabaseMeta,
      }),
    );
    renderApp(
      '/dashboard/forecasts',
      createAuthService({ getSession: vi.fn().mockResolvedValue(session) }),
      createAuthApiService(),
      dashboardApiService,
    );

    expect(await screen.findByRole('heading', { name: 'Forecast overview', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Oct 2025')).toBeInTheDocument();
    expect(screen.getByText('279,159.9')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  });

  it('redirects an authenticated user away from login', async () => {
    renderApp('/login', createAuthService({ getSession: vi.fn().mockResolvedValue(session) }));
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('waits for and restores a persisted session on dashboard refresh', async () => {
    let resolveSession: (value: Session) => void = () => undefined;
    const persistedSession = new Promise<Session>((resolve) => {
      resolveSession = resolve;
    });
    const { authApiService } = renderApp(
      '/dashboard',
      createAuthService({ getSession: vi.fn().mockReturnValue(persistedSession) }),
    );

    expect(screen.getByText('Loading your workspace…')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();

    resolveSession(session);

    expect(await screen.findByText('Secure session verified.')).toBeInTheDocument();
    expect(screen.getByText('backend@example.com')).toBeInTheDocument();
    expect(authApiService.getCurrentUser).toHaveBeenCalledWith('persisted-access-token');
  });

  it('refreshes once and returns to login when the backend rejects the session', async () => {
    const authService = createAuthService({
      getSession: vi.fn().mockResolvedValue(session),
      refreshSession: vi.fn().mockResolvedValue(null),
    });
    renderApp(
      '/dashboard',
      authService,
      createAuthApiService({
        getCurrentUser: vi.fn().mockRejectedValue(new ApiError('Unauthorized', 401)),
      }),
    );

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Your session expired. Please sign in again.')).toBeInTheDocument();
    expect(authService.refreshSession).toHaveBeenCalledOnce();
    expect(authService.signOut).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe('/login');
  });

  it('retries backend authentication with a refreshed access token', async () => {
    const refreshedSession = { ...session, access_token: 'refreshed-access-token' };
    const authService = createAuthService({
      getSession: vi.fn().mockResolvedValue(session),
      refreshSession: vi.fn().mockResolvedValue(refreshedSession),
    });
    const apiService = createAuthApiService({
      getCurrentUser: vi
        .fn()
        .mockRejectedValueOnce(new ApiError('Unauthorized', 401))
        .mockResolvedValueOnce({ id: 'user-123', email: 'backend@example.com' }),
    });
    renderApp('/dashboard', authService, apiService);

    expect(await screen.findByText('Secure session verified.')).toBeInTheDocument();
    expect(apiService.getCurrentUser).toHaveBeenNthCalledWith(1, 'persisted-access-token');
    expect(apiService.getCurrentUser).toHaveBeenNthCalledWith(2, 'refreshed-access-token');
    expect(authService.refreshSession).toHaveBeenCalledOnce();
    expect(authService.signOut).not.toHaveBeenCalled();
  });

  it('keeps the Supabase session and retries a backend connectivity failure', async () => {
    const apiService = createAuthApiService({
      getCurrentUser: vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ id: 'user-123', email: 'backend@example.com' }),
    });
    const user = userEvent.setup();
    renderApp(
      '/dashboard',
      createAuthService({ getSession: vi.fn().mockResolvedValue(session) }),
      apiService,
    );

    expect(
      await screen.findByText(
        'We could not reach the dashboard service. Check your connection and try again.',
      ),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Secure session verified.')).toBeInTheDocument();
    expect(apiService.getCurrentUser).toHaveBeenCalledTimes(2);
  });

  it('returns to login after sign-out', async () => {
    const authService = createAuthService({ getSession: vi.fn().mockResolvedValue(session) });
    const user = userEvent.setup();
    renderApp('/dashboard', authService);

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(authService.signOut).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe('/login');
  });

  it('keeps the user authenticated and shows a safe error when sign-out fails', async () => {
    const authService = createAuthService({
      getSession: vi.fn().mockResolvedValue(session),
      signOut: vi.fn().mockRejectedValue(new Error('Internal Supabase details')),
    });
    const user = userEvent.setup();
    renderApp('/dashboard', authService);

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(
      await screen.findByText('We could not sign you out. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Internal Supabase details')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('keeps open registration and routes an immediately authenticated account to dashboard', async () => {
    const authService = createAuthService({
      signUp: vi.fn().mockResolvedValue({ session, needsEmailConfirmation: false }),
    });
    const user = userEvent.setup();
    renderApp('/login', authService);

    await user.click(await screen.findByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Corporate e-mail'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.type(screen.getByLabelText('Confirm password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(authService.signUp).toHaveBeenCalledWith('new@example.com', 'correct-password');
  });

  it('keeps an email-confirmation registration on the login route', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(await screen.findByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Corporate e-mail'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.type(screen.getByLabelText('Confirm password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Check your e-mail to confirm your account.')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('renders the authenticated shell with its accessible structure and neutral content', async () => {
    const { authApiService } = renderApp(
      '/dashboard',
      createAuthService({ getSession: vi.fn().mockResolvedValue(session) }),
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(await screen.findByText('Secure session verified.')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'ShokAI' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('backend@example.com')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'dashboard-main');
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#dashboard-main',
    );
    expect(screen.getByRole('heading', { name: 'Summary indicators' })).toBeInTheDocument();
    expect(screen.queryByText('94.2%')).not.toBeInTheDocument();
    expect(screen.queryByText('Run prediction')).not.toBeInTheDocument();
    expect(authApiService.getCurrentUser).toHaveBeenCalledOnce();
  });

  it('opens and closes mobile navigation with its controls and the Escape key', async () => {
    window.innerWidth = 500;
    const user = userEvent.setup();
    renderApp(
      '/dashboard',
      createAuthService({ getSession: vi.fn().mockResolvedValue(session) }),
    );

    const menuButton = await screen.findByRole('button', { name: 'Open navigation' });
    await user.click(menuButton);

    expect(screen.getByRole('dialog', { name: 'Sidebar' })).toBeInTheDocument();
    const closeButton = screen.getByRole('button', { name: 'Close navigation' });
    expect(closeButton).toHaveFocus();

    await user.click(closeButton);
    expect(screen.queryByRole('dialog', { name: 'Sidebar' })).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();

    await user.click(menuButton);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Sidebar' })).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();
  });

  it('prevents duplicate sign-out requests while one is in progress', async () => {
    let resolveSignOut: () => void = () => undefined;
    const signOut = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSignOut = resolve;
      }),
    );
    const authService = createAuthService({
      getSession: vi.fn().mockResolvedValue(session),
      signOut,
    });
    const user = userEvent.setup();
    renderApp('/dashboard', authService);

    const signOutButton = await screen.findByRole('button', { name: 'Sign out' });
    await user.dblClick(signOutButton);

    expect(signOut).toHaveBeenCalledOnce();
    expect(signOutButton).toBeDisabled();
    resolveSignOut();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});
