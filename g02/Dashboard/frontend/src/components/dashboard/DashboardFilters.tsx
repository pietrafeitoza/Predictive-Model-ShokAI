import type { DashboardFilterOptions } from '@shokai/contracts';
import { Flame, SlidersHorizontal, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { DashboardFilterName } from '../../hooks/useDashboardFilters';
import { InfoTip } from './InfoTip';
import { MultiSelectFilter, type FilterOption } from './MultiSelectFilter';
import { useDashboardState } from './dashboard-state';

interface DashboardFiltersProps {
  error: boolean;
  isLoading: boolean;
  onRetry(): void;
  options?: DashboardFilterOptions;
  resultCount?: number;
}

const titleCase = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatMonth = (value: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC', year: 'numeric' }).format(
    new Date(`${value}-01T00:00:00Z`),
  );

interface FilterField {
  label: string;
  name: DashboardFilterName;
  options: FilterOption[];
}

const filterHints: Record<DashboardFilterName, string> = {
  operatorIds: 'Restrict the view to one or more operators.',
  treatmentLines: 'Restrict the view to one or more treatment lines.',
  providerStates: 'Restrict the view to one or more provider states.',
  forecastMonths: 'Restrict the view to one or more forecast months.',
  opportunityTiers: 'Restrict the view to one or more opportunity tiers.',
};

export function DashboardFilters({
  error,
  isLoading,
  onRetry,
  options,
  resultCount,
}: DashboardFiltersProps) {
  const {
    activeFilterCount,
    clearFilter,
    clearFilters,
    filters,
    hasActiveFilters,
    removeFilterValue,
    toggleFilterValue,
  } = useDashboardState();

  const fields: FilterField[] = [
    {
      label: 'Operator',
      name: 'operatorIds',
      options: (options?.operators ?? []).map(({ id, name }) => ({ label: name ?? id, value: id })),
    },
    {
      label: 'Treatment line',
      name: 'treatmentLines',
      options: (options?.treatmentLines ?? []).map((value) => ({ label: titleCase(value), value })),
    },
    {
      label: 'Provider state',
      name: 'providerStates',
      options: (options?.providerStates ?? []).map((value) => ({ label: value, value })),
    },
    {
      label: 'Forecast month',
      name: 'forecastMonths',
      options: (options?.forecastMonths ?? []).map((value) => ({ label: formatMonth(value), value })),
    },
    {
      label: 'Opportunity tier',
      name: 'opportunityTiers',
      options: (options?.opportunityTiers ?? []).map((value) => ({ label: titleCase(value), value })),
    },
  ];

  const highOpportunityActive =
    filters.opportunityTiers?.length === 1 && filters.opportunityTiers[0] === 'high';

  return (
    <section
      className="sticky top-[4.75rem] z-20 grid gap-3 rounded-2xl border border-border bg-white/90 p-3.5 shadow-[0_1px_2px_rgba(5,46,92,0.04),0_14px_30px_-24px_rgba(5,46,92,0.4)] backdrop-blur-xl"
      aria-labelledby="dashboard-filters-title"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-navy text-white">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
          </span>
          <h2
            id="dashboard-filters-title"
            className="font-heading text-[0.9375rem] font-bold tracking-[-0.01em] text-navy"
          >
            Filters
          </h2>
          {hasActiveFilters ? (
            <span className="grid min-w-5 place-items-center rounded-full bg-ocean px-1.5 font-mono text-[0.625rem] font-medium text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={highOpportunityActive}
            onClick={() =>
              highOpportunityActive
                ? clearFilter('opportunityTiers')
                : toggleFilterValue('opportunityTiers', 'high')
            }
            className={
              highOpportunityActive
                ? 'inline-flex h-8 items-center gap-1.5 rounded-full border border-leaf/40 bg-leaf-100 px-3 text-[0.75rem] font-semibold text-leaf-700'
                : 'inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[0.75rem] font-medium text-grey-600 transition-colors hover:border-leaf/40 hover:text-leaf-700'
            }
          >
            <Flame className="size-3.5" aria-hidden="true" />
            High opportunity
          </button>

          {typeof resultCount === 'number' ? (
            <span className="hidden items-center rounded-full bg-grey-50 px-3 py-1.5 font-mono text-[0.6875rem] text-grey-600 sm:inline-flex">
              {resultCount.toLocaleString('en-US')} records
            </span>
          ) : null}

          <Button
            type="button"
            variant={hasActiveFilters ? 'default' : 'outline'}
            size="sm"
            disabled={!hasActiveFilters}
            onClick={clearFilters}
            className="h-8 rounded-full"
          >
            Clear filters
          </Button>
        </div>
      </div>

      {error ? (
        <div
          className="flex items-center justify-between gap-4 rounded-xl border border-danger-border bg-danger-surface px-4 py-3 text-[0.8125rem] text-danger"
          role="alert"
        >
          <span>We could not load the available filters.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-current text-danger hover:bg-card hover:text-danger"
          >
            Retry
          </Button>
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-busy={isLoading}>
        {fields.map((field) => (
          <div key={field.name} className="grid min-w-0 gap-1">
            <span
              id={`${field.name}-label`}
              className="flex items-center gap-1 text-[0.6875rem] font-medium text-grey-600"
            >
              {field.label}
              <InfoTip label={`${field.label} filter`}>
                {filterHints[field.name]}
              </InfoTip>
            </span>
            <MultiSelectFilter
              label={field.label}
              options={field.options}
              values={filters[field.name] ?? []}
              disabled={isLoading || error || field.options.length === 0}
              searchable={field.name === 'operatorIds'}
              onToggle={(value) => toggleFilterValue(field.name, value)}
              onClear={() => clearFilter(field.name)}
            />
          </div>
        ))}
      </div>

      {hasActiveFilters ? (
        <div
          className="flex flex-wrap items-center gap-2 border-t border-border pt-3"
          aria-label="Active filters"
        >
          <span className="mr-0.5 font-mono text-[0.625rem] tracking-[0.12em] text-muted-foreground uppercase">
            Active
          </span>
          {fields.flatMap((field) => {
            const values = filters[field.name] ?? [];
            if (values.length === 0) return [];

            return values.map((value) => {
              const label = field.options.find((option) => option.value === value)?.label ?? value;

              return (
                <button
                  key={`${field.name}-${value}`}
                  type="button"
                  aria-label={`Remove ${field.label} filter: ${label}`}
                  onClick={() => removeFilterValue(field.name, value)}
                  className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-ocean-100 bg-ocean-50 py-1 pr-2 pl-3 text-[0.75rem] font-medium text-ocean-700 transition-colors hover:bg-ocean-100"
                >
                  <span>
                    {field.label}: {label}
                  </span>
                  <X className="size-3" aria-hidden="true" />
                </button>
              );
            });
          })}
        </div>
      ) : null}
    </section>
  );
}
