import type { DashboardDistributionResponse } from '@shokai/contracts';

export interface DashboardDistributionState {
  error: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  response: DashboardDistributionResponse | null;
  retry(): void;
}
