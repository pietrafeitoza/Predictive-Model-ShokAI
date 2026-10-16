import type { ModelRegistryResponse } from '@shokai/contracts';
import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '../services/api-client';
import type { DashboardApiService } from '../services/dashboard.service';

export function useModelRegistry(
  service: DashboardApiService,
  accessToken: string,
  onUnauthorized: () => void,
) {
  const [response, setResponse] = useState<ModelRegistryResponse | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [requestVersion, setRequestVersion] = useState(0);
  const retry = useCallback(() => setRequestVersion((version) => version + 1), []);

  useEffect(() => {
    let active = true;
    setError(false);
    setIsLoading(true);

    void service
      .getModelRegistry(accessToken)
      .then((nextResponse) => {
        if (active) setResponse(nextResponse);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          onUnauthorized();
          return;
        }
        setError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [accessToken, onUnauthorized, requestVersion, service]);

  return { error, isLoading, response, retry };
}
