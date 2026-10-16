import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '@supabase/supabase-js';
import type {
  DashboardFilters,
  PredictionListResponse,
  PredictionRecord,
} from '@shokai/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../App';
import { ApiError } from '../services/api-client';
import type { AuthApiService } from '../services/auth-api.service';
import type { AuthService } from '../services/auth.service';
import type { DashboardApiService } from '../services/dashboard.service';

const session = {
  access_token: 'dashboard-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  expires_at: 1_800_000_000,
  token_type: 'bearer',
  user: { id: 'user-123', email: 'analyst@example.com' },
} as Session;

const meta = {
  source: 'mock' as const,
  generatedAt: '2026-09-10T12:30:00.000Z',
  modelId: null,
  modelVersion: null,
};

const filterResponse = {
  data: {
    operators: [
      { id: 'OP-1', name: 'Operator One' },
      { id: 'OP-2', name: null },
    ],
    treatmentLines: ['staging', 'advanced'] as const,
    providerStates: ['AM', 'PA'] as const,
    forecastMonths: ['2026-09', '2026-10'],
    opportunityTiers: ['low', 'high'] as const,
  },
  meta,
};

const summaryResponse = {
  data: {
    totalEstimatedDemandVolume: 1234.75,
    predictionCount: 28,
    operatorCount: 4,
    highOpportunityRecordCount: 7,
  },
  meta,
};

function createPrediction(
  predictionId: string,
  predictedDemandVolume: number,
  overrides: Partial<PredictionRecord> = {},
): PredictionRecord {
  return {
    predictionId,
    operatorId: `OP-${predictionId}`,
    operatorName: `Operator ${predictionId}`,
    treatmentLine: 'advanced',
    providerState: 'AM',
    referenceMonth: '2026-08',
    forecastMonth: '2026-09',
    predictedDemandVolume,
    observedDemandVolume: null,
    opportunityTier: 'high',
    modelId: 'mock-model',
    modelVersion: '0.0.0',
    generatedAt: '2026-09-10T12:00:00.000Z',
    ...overrides,
  };
}

const predictionResponse: PredictionListResponse = {
  data: Array.from({ length: 12 }, (_, index) =>
    createPrediction(`P-${index + 1}`, 120 - index),
  ),
  meta,
};

const distributionData = {
  provider_state: [
    { key: 'AM', label: 'AM', estimatedDemandVolume: 650.5, predictionCount: 8 },
    { key: 'PA', label: 'PA', estimatedDemandVolume: 584.25, predictionCount: 7 },
  ],
  treatment_line: [
    { key: 'staging', label: 'Staging', estimatedDemandVolume: 320, predictionCount: 5 },
    { key: 'advanced', label: 'Advanced', estimatedDemandVolume: 914.75, predictionCount: 10 },
  ],
  opportunity_tier: [
    { key: 'low', label: 'Low', estimatedDemandVolume: 184, predictionCount: 4 },
    { key: 'medium', label: 'Medium', estimatedDemandVolume: 390.75, predictionCount: 5 },
    { key: 'high', label: 'High', estimatedDemandVolume: 660, predictionCount: 6 },
  ],
} as const;

function createAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    getSession: vi.fn().mockResolvedValue(session),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
    refreshSession: vi.fn().mockResolvedValue(null),
    signIn: vi.fn().mockResolvedValue(session),
    signUp: vi.fn().mockResolvedValue({ session: null, needsEmailConfirmation: true }),
    signOut: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createDashboardService(overrides: Partial<DashboardApiService> = {}): DashboardApiService {
  const service: DashboardApiService = {
    getDistribution: vi.fn().mockImplementation((dimension: keyof typeof distributionData) =>
      Promise.resolve({ data: distributionData[dimension], meta })),
    getFilterOptions: vi.fn().mockResolvedValue(filterResponse),
    getPredictions: vi.fn().mockResolvedValue(predictionResponse),
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
    getSummary: vi.fn().mockResolvedValue(summaryResponse),
    ...overrides,
  };

  return service;
}

function renderDashboard(
  dashboardService = createDashboardService(),
  authService = createAuthService(),
  path = '/dashboard',
) {
  const authApiService: AuthApiService = {
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-123', email: 'api@example.com' }),
  };
  window.history.pushState({}, '', path);
  render(
    <App
      authApiService={authApiService}
      authService={authService}
      dashboardApiService={dashboardService}
    />,
  );
  return { authApiService, authService, dashboardService };
}

async function selectFilter(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string,
) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('DashboardPage data slice', () => {
  beforeEach(() => window.history.pushState({}, '', '/'));

  it('loads API filter options and renders only the five supported categories', async () => {
    const user = userEvent.setup();
    const { dashboardService } = renderDashboard();

    expect(await screen.findByRole('combobox', { name: 'Operator' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Treatment line' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Provider state' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Forecast month' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Opportunity tier' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Municipality' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Verticalization' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Operator' }));
    expect(await screen.findByRole('option', { name: 'Operator One' })).toBeInTheDocument();
    expect(dashboardService.getFilterOptions).toHaveBeenCalledWith('dashboard-token');
  });

  it('sends selected categories together, omits empty values, and supports chip removal', async () => {
    const user = userEvent.setup();
    const service = createDashboardService();
    renderDashboard(service);
    await screen.findByRole('combobox', { name: 'Operator' });

    await selectFilter(user, 'Operator', 'Operator One');
    await waitFor(() =>
      expect(service.getSummary).toHaveBeenLastCalledWith(
        { operatorIds: ['OP-1'] },
        'dashboard-token',
      ),
    );

    await selectFilter(user, 'Treatment line', 'Advanced');
    await selectFilter(user, 'Provider state', 'AM');
    await waitFor(() =>
      expect(service.getSummary).toHaveBeenLastCalledWith(
        {
          operatorIds: ['OP-1'],
          providerStates: ['AM'],
          treatmentLines: ['advanced'],
        },
        'dashboard-token',
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Remove Operator filter: Operator One' }));
    await waitFor(() =>
      expect(service.getSummary).toHaveBeenLastCalledWith(
        { providerStates: ['AM'], treatmentLines: ['advanced'] },
        'dashboard-token',
      ),
    );
    expect(window.location.search).not.toContain('operatorIds');
  });

  it('clears every filter and requests the unfiltered summary', async () => {
    const user = userEvent.setup();
    const service = createDashboardService();
    renderDashboard(service);
    await screen.findByRole('combobox', { name: 'Forecast month' });

    await selectFilter(user, 'Forecast month', 'Sep 2026');
    await selectFilter(user, 'Opportunity tier', 'High');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() =>
      expect(service.getSummary).toHaveBeenLastCalledWith({}, 'dashboard-token'),
    );
    await waitFor(() => {
      const calls = vi.mocked(service.getDistribution).mock.calls;
      for (const dimension of ['provider_state', 'treatment_line', 'opportunity_tier'] as const) {
        expect(calls.filter(([requestedDimension]) => requestedDimension === dimension).at(-1)).toEqual([
          dimension,
          {},
          'dashboard-token',
        ]);
      }
    });
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
  });

  it('restores valid URL filters and removes invalid values without a navigation loop', async () => {
    const service = createDashboardService();
    renderDashboard(
      service,
      createAuthService(),
      '/dashboard?providerStates=invalid&forecastMonths=2026-09&view=preview',
    );

    await screen.findByRole('combobox', { name: 'Forecast month' });
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Forecast month' })).toHaveTextContent('Sep 2026'),
    );
    await waitFor(() => expect(window.location.search).not.toContain('providerStates'));
    expect(window.location.search).toContain('forecastMonths=2026-09');
    expect(window.location.search).toContain('view=preview');
    expect(service.getSummary).toHaveBeenLastCalledWith(
      { forecastMonths: ['2026-09'] },
      'dashboard-token',
    );
  });

  it('displays the four backend indicators with precise definitions and mock disclosure', async () => {
    renderDashboard();

    await screen.findByText('1,234.75');
    const summary = screen.getByRole('heading', { name: 'Summary indicators' });
    const section = summary.closest('section')!;
    expect(within(section).getByText('1,234.75')).toBeInTheDocument();
    expect(within(section).getByText('28')).toBeInTheDocument();
    expect(within(section).getByText('4')).toBeInTheDocument();
    expect(within(section).getByText('7')).toBeInTheDocument();
    expect(within(section).getByRole('heading', { name: 'Estimated demand volume' })).toBeInTheDocument();
    expect(within(section).getByText('Numeric billed-item utilization volume.')).toBeInTheDocument();
    expect(within(section).getByText('Number of prediction result records.')).toBeInTheDocument();
    expect(within(section).getByText('Distinct operators in the filtered result.')).toBeInTheDocument();
    expect(within(section).getByText('Prediction records classified as high opportunity.')).toBeInTheDocument();
    expect(screen.getByText('Dashboard preview — mock data')).toBeInTheDocument();
    expect(screen.queryByText(/model version/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/selected model/i)).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: /opportunity ranking/i })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /chart/i })).not.toBeInTheDocument();
  });

  it('shows Supabase disclosure and selected Random Forest information only when metadata exists', async () => {
    const supabaseMeta = {
      source: 'supabase' as const,
      generatedAt: '2026-09-10T12:30:00.000Z',
      modelId: 'north-region-mama-demand-random-forest',
      modelVersion: 'forest-v1',
    };
    renderDashboard(
      createDashboardService({
        getSelectedModel: vi.fn().mockResolvedValue({
          data: {
            modelId: supabaseMeta.modelId,
            modelVersion: supabaseMeta.modelVersion,
            algorithm: 'random_forest',
            status: 'selected',
            targetTechnicalName: 'volume_demanda_proxy',
            targetDisplayName: 'Estimated demand volume',
            targetUnit: 'billed item quantity',
            granularity: ['operator', 'treatment_line', 'provider_state', 'month'],
            trainingPeriodStart: null,
            trainingPeriodEnd: '2025-09',
            holdoutPeriodStart: '2025-10',
            holdoutPeriodEnd: '2025-12',
            metrics: { mae: 57.471, rmse: 362.961, r2: 0.802 },
            metricScope: 'observed_only_holdout',
            caveat: 'Estimated billed-item utilization demand volume; not confirmed clinical demand.',
            generatedAt: '2026-09-10T12:00:00.000Z',
          },
          meta: supabaseMeta,
        }),
      }),
    );

    expect(await screen.findByText('Dashboard data loaded from Supabase')).toBeInTheDocument();
    const panel = screen.getByRole('heading', { name: 'Random Forest' }).closest('section')!;
    expect(within(panel).getByText('Version forest-v1')).toBeInTheDocument();
    expect(within(panel).getByText('Estimated demand volume')).toBeInTheDocument();
    expect(within(panel).getByText('Billed item quantity')).toBeInTheDocument();
    expect(within(panel).getByText('Through 2025-09')).toBeInTheDocument();
    expect(within(panel).getByText('2025-10 to 2025-12')).toBeInTheDocument();
    expect(within(panel).getByText('Observed-only holdout')).toBeInTheDocument();
    expect(within(panel).getByText('57.47')).toBeInTheDocument();
    expect(within(panel).getByText('362.96')).toBeInTheDocument();
    expect(within(panel).getByText('0.802')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard preview — mock data')).not.toBeInTheDocument();
    expect(screen.queryByText(/hyperparameter|feature list|random state/i)).not.toBeInTheDocument();
  });

  it('requests every supported distribution and sends active filters to every chart', async () => {
    const user = userEvent.setup();
    const service = createDashboardService();
    renderDashboard(service);

    expect(await screen.findByRole('heading', { name: 'Estimated demand by provider state' })).toBeInTheDocument();
    await waitFor(() => {
      expect(service.getDistribution).toHaveBeenCalledWith(
        'provider_state',
        {},
        'dashboard-token',
      );
      expect(service.getDistribution).toHaveBeenCalledWith(
        'treatment_line',
        {},
        'dashboard-token',
      );
      expect(service.getDistribution).toHaveBeenCalledWith(
        'opportunity_tier',
        {},
        'dashboard-token',
      );
    });

    await selectFilter(user, 'Forecast month', 'Sep 2026');
    await selectFilter(user, 'Treatment line', 'Advanced');

    await waitFor(() => {
      for (const dimension of ['provider_state', 'treatment_line', 'opportunity_tier'] as const) {
        expect(service.getDistribution).toHaveBeenCalledWith(
          dimension,
          { forecastMonths: ['2026-09'], treatmentLines: ['advanced'] },
          'dashboard-token',
        );
      }
    });
  });

  it('requests protected predictions and sends the same active dashboard filters', async () => {
    const user = userEvent.setup();
    const service = createDashboardService();
    renderDashboard(service);

    expect(await screen.findByRole('heading', { name: 'Opportunity ranking' })).toBeInTheDocument();
    expect(service.getPredictions).toHaveBeenCalledWith({}, 'dashboard-token');

    await screen.findByRole('combobox', { name: 'Provider state' });
    await selectFilter(user, 'Provider state', 'AM');
    await selectFilter(user, 'Treatment line', 'Advanced');

    await waitFor(() => {
      expect(service.getPredictions).toHaveBeenLastCalledWith(
        { providerStates: ['AM'], treatmentLines: ['advanced'] },
        'dashboard-token',
      );
    });
    expect(screen.getByRole('heading', { name: 'Estimated demand by provider state' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estimated demand by treatment line' })).toBeInTheDocument();
  });

  it('keeps the dashboard shell, filters, indicators, and charts while predictions load', async () => {
    const pendingPredictions = new Promise<PredictionListResponse>(() => undefined);
    renderDashboard(
      createDashboardService({ getPredictions: vi.fn().mockReturnValue(pendingPredictions) }),
    );

    expect(await screen.findByRole('heading', { name: 'Opportunity ranking' })).toBeInTheDocument();
    expect(screen.getAllByTestId('ranking-skeleton-row')).toHaveLength(5);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Summary indicators' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Visualizations' })).toBeInTheDocument();
  });

  it('retries a failed prediction request without removing other dashboard content', async () => {
    const user = userEvent.setup();
    const getPredictions = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue(predictionResponse);
    renderDashboard(createDashboardService({ getPredictions }));

    expect(await screen.findByText('We could not load the opportunity records.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Visualizations' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(getPredictions).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Showing 1–10 of 12 records')).toBeInTheDocument();
  });

  it('opens a record detail dialog when a ranking row is clicked', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByText('Showing 1–10 of 12 records');
    await user.click(screen.getByText('Operator P-1'));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Reference month')).toBeInTheDocument();
    expect(screen.getByText('Observed volume')).toBeInTheDocument();
    expect(screen.getByText(/mock-model · 0\.0\.0/)).toBeInTheDocument();
  });

  it('shows the table empty state for filtered prediction results and clears through shared filters', async () => {
    const user = userEvent.setup();
    const getPredictions = vi.fn((filters: DashboardFilters) =>
      Promise.resolve(filters.providerStates ? { data: [], meta } : predictionResponse),
    );
    const service = createDashboardService({ getPredictions });
    renderDashboard(service);

    await screen.findByText('Showing 1–10 of 12 records');
    await selectFilter(user, 'Provider state', 'AM');

    expect(
      await screen.findByText('No opportunity records match the selected filters.'),
    ).toBeInTheDocument();
    const emptyState = screen.getByText(
      'No opportunity records match the selected filters.',
    ).closest<HTMLElement>('[role="status"]')!;
    await user.click(within(emptyState).getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(service.getPredictions).toHaveBeenLastCalledWith({}, 'dashboard-token'));
    expect(screen.getByRole('combobox', { name: 'Provider state' })).toHaveTextContent('All');
  });

  it('renders all chart titles, descriptions, values, and accessible summaries', async () => {
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Estimated demand by provider state' })).toBeInTheDocument();
    expect(screen.getByText('Estimated billed-item utilization volume across provider states.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estimated demand by treatment line' })).toBeInTheDocument();
    expect(screen.getByText('Estimated billed-item utilization volume across treatment lines.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Opportunity distribution' })).toBeInTheDocument();
    expect(screen.getByText('Estimated billed-item utilization volume across opportunity tiers.')).toBeInTheDocument();

    const summaries = await screen.findAllByTestId('chart-accessible-summary');
    expect(summaries).toHaveLength(3);
    expect(summaries[0]).toHaveTextContent('AM: estimated demand volume 650.5; 8 prediction records.');
    expect(summaries[1]).toHaveTextContent('Low: estimated demand volume 184; 4 prediction records.');
    expect(summaries[2]).toHaveTextContent('Advanced: estimated demand volume 914.75; 10 prediction records.');
    expect(screen.getByText('660')).toBeInTheDocument();
    expect(screen.getByText('6 prediction records')).toBeInTheDocument();
    expect(screen.queryByText(/predicted patients/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/patient demand/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });

  it('keeps the dashboard shell visible while charts load independently', async () => {
    const pending = new Promise(() => undefined);
    renderDashboard(createDashboardService({ getDistribution: vi.fn().mockReturnValue(pending) }));

    expect(await screen.findByRole('heading', { name: 'Visualizations' })).toBeInTheDocument();
    expect(screen.getAllByTestId('chart-loading-state')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Summary indicators' })).toBeInTheDocument();
  });

  it('renders neutral chart empty states for an empty distribution response', async () => {
    renderDashboard(createDashboardService({
      getDistribution: vi.fn().mockResolvedValue({ data: [], meta }),
    }));

    expect(await screen.findAllByText('No data is available for the selected filters.')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('retries one failed distribution without removing successful charts', async () => {
    const user = userEvent.setup();
    const getDistribution = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new TypeError('offline')))
      .mockImplementation((dimension: keyof typeof distributionData) =>
        Promise.resolve({ data: distributionData[dimension], meta }));
    const service = createDashboardService({ getDistribution });
    renderDashboard(service);

    const retry = await screen.findByRole('button', {
      name: 'Retry Estimated demand by provider state',
    });
    expect(screen.getByRole('heading', { name: 'Opportunity distribution' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estimated demand by treatment line' })).toBeInTheDocument();
    expect(screen.getAllByTestId('chart-accessible-summary')).toHaveLength(2);

    await user.click(retry);

    await waitFor(() => expect(getDistribution).toHaveBeenCalledTimes(4));
    expect(await screen.findAllByTestId('chart-accessible-summary')).toHaveLength(3);
  });

  it('keeps stable indicator skeletons visible while the first summary loads', async () => {
    let resolveSummary: (value: typeof summaryResponse) => void = () => undefined;
    const pending = new Promise<typeof summaryResponse>((resolve) => { resolveSummary = resolve; });
    renderDashboard(createDashboardService({ getSummary: vi.fn().mockReturnValue(pending) }));

    expect(await screen.findByRole('heading', { name: 'Summary indicators' })).toBeInTheDocument();
    expect(screen.getAllByTestId('indicator-skeleton')).toHaveLength(4);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    resolveSummary(summaryResponse);
    expect(await screen.findByText('1,234.75')).toBeInTheDocument();
  });

  it('shows independent retry actions for summary and filter-option failures', async () => {
    const user = userEvent.setup();
    const service = createDashboardService({
      getFilterOptions: vi
        .fn()
        .mockRejectedValueOnce(new TypeError('offline'))
        .mockResolvedValue(filterResponse),
      getSummary: vi
        .fn()
        .mockRejectedValueOnce(new TypeError('offline'))
        .mockResolvedValue(summaryResponse),
    });
    renderDashboard(service);

    const filterMessage = await screen.findByText('We could not load the available filters.');
    const summaryMessage = await screen.findByText('We could not load the dashboard summary.');
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Value unavailable')).toHaveLength(4);

    await user.click(within(filterMessage.parentElement!).getByRole('button', { name: 'Retry' }));
    await user.click(within(summaryMessage.parentElement!).getByRole('button', { name: 'Retry' }));

    await user.click(await screen.findByRole('combobox', { name: 'Operator' }));
    expect(await screen.findByRole('option', { name: 'Operator One' })).toBeInTheDocument();
    expect(await screen.findByText('1,234.75')).toBeInTheDocument();
    expect(service.getFilterOptions).toHaveBeenCalledTimes(2);
    expect(service.getSummary).toHaveBeenCalledTimes(2);
  });

  it('treats a filtered zero summary as a valid empty state and retains zero cards', async () => {
    const user = userEvent.setup();
    const zeroResponse = {
      ...summaryResponse,
      data: {
        totalEstimatedDemandVolume: 0,
        predictionCount: 0,
        operatorCount: 0,
        highOpportunityRecordCount: 0,
      },
    };
    renderDashboard(createDashboardService({ getSummary: vi.fn().mockResolvedValue(zeroResponse) }));
    await screen.findByRole('combobox', { name: 'Operator' });
    await selectFilter(user, 'Operator', 'OP-2');

    expect(await screen.findByText('No dashboard records match the selected filters.')).toBeInTheDocument();
    const indicatorSection = screen.getByRole('heading', { name: 'Summary indicators' }).closest('section')!;
    expect(within(indicatorSection).getAllByText('0')).toHaveLength(4);
  });

  it('uses the existing authentication invalidation path for a dashboard 401', async () => {
    const authService = createAuthService();
    renderDashboard(
      createDashboardService({
        getFilterOptions: vi.fn().mockRejectedValue(new ApiError('Unauthorized', 401)),
        getSummary: vi.fn().mockRejectedValue(new ApiError('Unauthorized', 401)),
      }),
      authService,
    );

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Your session expired. Please sign in again.')).toBeInTheDocument();
    expect(authService.refreshSession).toHaveBeenCalledOnce();
    expect(authService.signOut).toHaveBeenCalledOnce();
  });

  it('uses the existing authentication invalidation path for a predictions 401', async () => {
    const authService = createAuthService();
    renderDashboard(
      createDashboardService({
        getPredictions: vi.fn().mockRejectedValue(new ApiError('Unauthorized', 401)),
      }),
      authService,
    );

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Your session expired. Please sign in again.')).toBeInTheDocument();
    expect(authService.refreshSession).toHaveBeenCalledOnce();
    expect(authService.signOut).toHaveBeenCalledOnce();
  });

  it('uses the existing authentication invalidation path for a distribution 401', async () => {
    const authService = createAuthService();
    renderDashboard(
      createDashboardService({
        getDistribution: vi.fn().mockRejectedValue(new ApiError('Unauthorized', 401)),
      }),
      authService,
    );

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Your session expired. Please sign in again.')).toBeInTheDocument();
    expect(authService.refreshSession).toHaveBeenCalledOnce();
    expect(authService.signOut).toHaveBeenCalledOnce();
  });

  it('refreshes the session once and retries dashboard requests before signing out', async () => {
    const refreshedSession = { ...session, access_token: 'refreshed-dashboard-token' };
    const authService = createAuthService({
      refreshSession: vi.fn().mockResolvedValue(refreshedSession),
    });
    const getPredictions = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('Unauthorized', 401))
      .mockResolvedValue(predictionResponse);

    renderDashboard(createDashboardService({ getPredictions }), authService);

    await waitFor(() => {
      expect(getPredictions).toHaveBeenCalledWith({}, 'refreshed-dashboard-token');
    });
    expect(authService.refreshSession).toHaveBeenCalledOnce();
    expect(authService.signOut).not.toHaveBeenCalled();
    expect(await screen.findByText('Showing 1–10 of 12 records')).toBeInTheDocument();
  });
});
