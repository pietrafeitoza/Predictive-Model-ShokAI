import type { DashboardFilters } from '@shokai/contracts';
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';

import { useDashboardFilters, type DashboardFilterName } from '../../hooks/useDashboardFilters';

interface DashboardStateValue {
  activeFilterCount: number;
  clearFilter(name: DashboardFilterName): void;
  clearFilters(): void;
  filters: DashboardFilters;
  hasActiveFilters: boolean;
  removeFilterValue(name: DashboardFilterName, value: string): void;
  replaceFilters(filters: DashboardFilters): void;
  setFilterValues(name: DashboardFilterName, values: string[]): void;
  toggleFilterValue(name: DashboardFilterName, value: string): void;
}

const DashboardStateContext = createContext<DashboardStateValue | null>(null);

export function DashboardStateProvider({ children }: PropsWithChildren) {
  const filtersApi = useDashboardFilters();
  const value = useMemo<DashboardStateValue>(() => filtersApi, [filtersApi]);

  return (
    <DashboardStateContext.Provider value={value}>{children}</DashboardStateContext.Provider>
  );
}

export function useDashboardState(): DashboardStateValue {
  const context = useContext(DashboardStateContext);

  if (!context) {
    throw new Error('useDashboardState must be used within a DashboardStateProvider');
  }

  return context;
}
