import type { DashboardFilters, DashboardSummaryResponse } from '@shokai/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../services/api-client';
import type { DashboardApiService } from '../services/dashboard.service';

export function useDashboardSummary(
  service: DashboardApiService,
  accessToken: string,
  filters: DashboardFilters,
  onUnauthorized: () => void,
) {
  const [response, setResponse] = useState<DashboardSummaryResponse | null>(null);
  const [error, setError] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [requestVersion, setRequestVersion] = useState(0);
  const latestRequest = useRef(0);
  const filterKey = JSON.stringify(filters);

  const retry = useCallback(() => setRequestVersion((version) => version + 1), []);

  useEffect(() => {
    const requestId = ++latestRequest.current;
    let active = true;
    setError(false);
    setIsFetching(true);

    void service
      .getSummary(filters, accessToken)
      .then((nextResponse) => {
        if (active && requestId === latestRequest.current) setResponse(nextResponse);
      })
      .catch((requestError: unknown) => {
        if (!active || requestId !== latestRequest.current) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          onUnauthorized();
          return;
        }
        setError(true);
      })
      .finally(() => {
        if (active && requestId === latestRequest.current) setIsFetching(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, filterKey, onUnauthorized, requestVersion, service]);

  return {
    error,
    isLoading: isFetching && !response,
    isRefreshing: isFetching && Boolean(response),
    response,
    retry,
  };
}
