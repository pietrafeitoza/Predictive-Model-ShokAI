import type { DashboardFilters } from '@shokai/contracts';

import { OpportunityTierChart } from './OpportunityTierChart';
import { ProviderStateDemandChart } from './ProviderStateDemandChart';
import { TreatmentLineDemandChart } from './TreatmentLineDemandChart';
import type { DashboardDistributionState } from './chart-types';

interface DashboardVisualizationsProps {
  filters: DashboardFilters;
  onToggleProviderState(key: string): void;
  onToggleTreatmentLine(key: string): void;
  onToggleOpportunityTier(key: string): void;
  opportunityTier: DashboardDistributionState;
  providerState: DashboardDistributionState;
  treatmentLine: DashboardDistributionState;
}

export function DashboardVisualizations({
  filters,
  onToggleOpportunityTier,
  onToggleProviderState,
  onToggleTreatmentLine,
  opportunityTier,
  providerState,
  treatmentLine,
}: DashboardVisualizationsProps) {
  return (
    <section className="grid gap-[18px]" aria-labelledby="dashboard-visualizations-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <span className="text-[0.75rem] font-medium text-ocean-600">
            Demand breakdown
          </span>
          <h2
            id="dashboard-visualizations-title"
            className="font-heading text-lg font-bold tracking-[-0.02em] text-navy"
          >
            Visualizations
          </h2>
        </div>
        <p className="text-[0.75rem] text-muted-foreground">
          Click any bar, tier, or segment to filter the whole dashboard.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <ProviderStateDemandChart
          state={providerState}
          activeKeys={filters.providerStates ?? []}
          onSelect={onToggleProviderState}
        />
        <OpportunityTierChart
          state={opportunityTier}
          activeKeys={filters.opportunityTiers ?? []}
          onSelect={onToggleOpportunityTier}
        />
        <TreatmentLineDemandChart
          state={treatmentLine}
          activeKeys={filters.treatmentLines ?? []}
          onSelect={onToggleTreatmentLine}
        />
      </div>
    </section>
  );
}
