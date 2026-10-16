import { DashboardDataNotice } from './DashboardDataNotice';
import { DashboardFilters } from './DashboardFilters';
import { IndicatorGrid } from './IndicatorGrid';
import { OpportunityRankingTable } from './OpportunityRankingTable';
import { SelectedModelPanel } from './SelectedModelPanel';
import { DashboardVisualizations } from './charts/DashboardVisualizations';
import { useDashboardDistribution } from '../../hooks/useDashboardDistribution';
import { useDashboardFilterOptions } from '../../hooks/useDashboardFilterOptions';
import { useDashboardPredictions } from '../../hooks/useDashboardPredictions';
import { useDashboardSummary } from '../../hooks/useDashboardSummary';
import { useSelectedModel } from '../../hooks/useSelectedModel';
import type { DashboardApiService } from '../../services/dashboard.service';
import { Button } from '@/components/ui/button';
import { useDashboardState } from './dashboard-state';

interface DashboardDataContentProps {
  accessToken: string;
  onUnauthorized(): void;
  service: DashboardApiService;
}

export function DashboardDataContent({
  accessToken,
  onUnauthorized,
  service,
}: DashboardDataContentProps) {
  const {
    clearFilter,
    clearFilters,
    filters,
    hasActiveFilters,
    setFilterValues,
    toggleFilterValue,
  } = useDashboardState();
  const filterOptions = useDashboardFilterOptions(service, accessToken, onUnauthorized);
  const predictions = useDashboardPredictions(service, accessToken, filters, onUnauthorized);
  const summary = useDashboardSummary(service, accessToken, filters, onUnauthorized);
  const providerState = useDashboardDistribution(
    service,
    accessToken,
    'provider_state',
    filters,
    onUnauthorized,
  );
  const treatmentLine = useDashboardDistribution(
    service,
    accessToken,
    'treatment_line',
    filters,
    onUnauthorized,
  );
  const opportunityTier = useDashboardDistribution(
    service,
    accessToken,
    'opportunity_tier',
    filters,
    onUnauthorized,
  );
  const selectedModel = useSelectedModel(service, accessToken, onUnauthorized);
  const responses = [
    selectedModel.response,
    filterOptions.response,
    predictions.response,
    summary.response,
    providerState.response,
    treatmentLine.response,
    opportunityTier.response,
  ];
  const source = responses.find((response) => response?.meta.source)?.meta.source ?? null;
  const isEmpty =
    hasActiveFilters && !summary.isLoading && summary.response?.data.predictionCount === 0;
  const highOpportunityActive =
    filters.opportunityTiers?.length === 1 && filters.opportunityTiers[0] === 'high';

  function toggleHighOpportunity() {
    if (highOpportunityActive) {
      clearFilter('opportunityTiers');
      return;
    }

    setFilterValues('opportunityTiers', ['high']);
  }

  return (
    <>
      {source ? <DashboardDataNotice source={source} /> : null}

      {source === 'supabase' ? (
        <SelectedModelPanel
          error={selectedModel.error}
          isLoading={selectedModel.isLoading}
          model={selectedModel.response?.data}
          onRetry={selectedModel.retry}
        />
      ) : null}

      <DashboardFilters
        error={filterOptions.error}
        isLoading={filterOptions.isLoading}
        onRetry={filterOptions.retry}
        options={filterOptions.response?.data}
        resultCount={predictions.response?.data.length}
      />

      {isEmpty ? (
        <div
          className="flex items-center justify-between gap-4 rounded-xl border border-ocean-100 bg-ocean-50 px-4 py-3.5 text-[0.8125rem] text-navy max-sm:flex-col max-sm:items-stretch"
          role="status"
        >
          <div className="grid gap-1">
            <strong className="text-sm">No dashboard records match the selected filters.</strong>
            <span className="text-muted-foreground">Clear the filters to return to the full dataset.</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={clearFilters} className="shrink-0">
            Clear filters
          </Button>
        </div>
      ) : null}

      <IndicatorGrid
        error={summary.error}
        highOpportunityActive={highOpportunityActive}
        isLoading={summary.isLoading}
        isRefreshing={summary.isRefreshing}
        onRetry={summary.retry}
        onShowHighOpportunity={toggleHighOpportunity}
        summary={summary.response?.data}
      />

      <DashboardVisualizations
        filters={filters}
        opportunityTier={opportunityTier}
        providerState={providerState}
        treatmentLine={treatmentLine}
        onToggleOpportunityTier={(key) => toggleFilterValue('opportunityTiers', key)}
        onToggleProviderState={(key) => toggleFilterValue('providerStates', key)}
        onToggleTreatmentLine={(key) => toggleFilterValue('treatmentLines', key)}
      />

      <OpportunityRankingTable
        error={predictions.error}
        filters={filters}
        isLoading={predictions.isLoading}
        isRefreshing={predictions.isRefreshing}
        onClearFilters={clearFilters}
        onRetry={predictions.retry}
        predictions={predictions.response?.data}
      />
    </>
  );
}
