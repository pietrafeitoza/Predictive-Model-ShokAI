import {
  DashboardFiltersSchema,
  OpportunityTierSchema,
  ProviderStateSchema,
  TreatmentLineSchema,
  YearMonthSchema,
  type DashboardFilters,
} from '@shokai/contracts';
import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const filterSchemas = {
  operatorIds: { safeParse: (value: string) => ({ success: value.length > 0 }) },
  treatmentLines: TreatmentLineSchema,
  providerStates: ProviderStateSchema,
  forecastMonths: YearMonthSchema,
  opportunityTiers: OpportunityTierSchema,
} as const;

export type DashboardFilterName = keyof typeof filterSchemas;

export const dashboardFilterNames = Object.keys(filterSchemas) as DashboardFilterName[];

function isValidValue(name: DashboardFilterName, value: string): boolean {
  return filterSchemas[name].safeParse(value).success;
}

function parseFilters(searchParams: URLSearchParams): DashboardFilters {
  const candidate: Record<string, string[]> = {};

  for (const name of dashboardFilterNames) {
    const values = Array.from(
      new Set(searchParams.getAll(name).filter((value) => isValidValue(name, value))),
    );

    if (values.length > 0) candidate[name] = values;
  }

  return DashboardFiltersSchema.parse(candidate);
}

function writeFilters(params: URLSearchParams, filters: DashboardFilters): void {
  for (const name of dashboardFilterNames) {
    params.delete(name);
    for (const value of filters[name] ?? []) {
      if (isValidValue(name, value)) params.append(name, value);
    }
  }
}

export function useDashboardFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  useEffect(() => {
    const normalized = new URLSearchParams(searchParams);

    writeFilters(normalized, filters);

    if (normalized.toString() !== searchParams.toString()) {
      setSearchParams(normalized, { replace: true });
    }
  }, [filters, searchParams, setSearchParams]);

  const mutate = useCallback(
    (updater: (next: DashboardFilters) => DashboardFilters) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);

        writeFilters(next, updater(parseFilters(previous)));

        return next;
      });
    },
    [setSearchParams],
  );

  const setFilterValues = useCallback(
    (name: DashboardFilterName, values: string[]) => {
      mutate((current) => {
        const unique = Array.from(new Set(values)).filter((value) => isValidValue(name, value));

        return { ...current, [name]: unique.length > 0 ? unique : undefined };
      });
    },
    [mutate],
  );

  const toggleFilterValue = useCallback(
    (name: DashboardFilterName, value: string) => {
      if (!isValidValue(name, value)) return;

      mutate((current) => {
        const existing = current[name] ?? [];
        const nextValues = existing.includes(value)
          ? existing.filter((item) => item !== value)
          : [...existing, value];

        return { ...current, [name]: nextValues.length > 0 ? nextValues : undefined };
      });
    },
    [mutate],
  );

  const removeFilterValue = useCallback(
    (name: DashboardFilterName, value: string) => {
      mutate((current) => {
        const nextValues = (current[name] ?? []).filter((item) => item !== value);

        return { ...current, [name]: nextValues.length > 0 ? nextValues : undefined };
      });
    },
    [mutate],
  );

  const clearFilter = useCallback(
    (name: DashboardFilterName) => {
      mutate((current) => ({ ...current, [name]: undefined }));
    },
    [mutate],
  );

  const clearFilters = useCallback(() => {
    mutate(() => ({}));
  }, [mutate]);

  const replaceFilters = useCallback(
    (next: DashboardFilters) => {
      mutate(() => next);
    },
    [mutate],
  );

  const activeFilterCount = dashboardFilterNames.reduce(
    (total, name) => total + (filters[name]?.length ?? 0),
    0,
  );

  return {
    activeFilterCount,
    clearFilter,
    clearFilters,
    filters,
    hasActiveFilters: activeFilterCount > 0,
    removeFilterValue,
    replaceFilters,
    setFilterValues,
    toggleFilterValue,
  };
}
