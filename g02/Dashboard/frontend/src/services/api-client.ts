import {
  clearApiCache,
  clearInflight,
  createCacheKey,
  readCache,
  readInflight,
  writeCache,
  writeInflight,
} from './api-cache';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiConfigurationError extends Error {
  constructor() {
    super('The backend API is not configured.');
    this.name = 'ApiConfigurationError';
  }
}

export interface ApiClient {
  get<T>(path: string, accessToken: string): Promise<T>;
  put<T>(path: string, accessToken: string): Promise<T>;
}

function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');

  if (!baseUrl) {
    throw new ApiConfigurationError();
  }

  return baseUrl;
}

async function request<T>(
  method: 'GET' | 'PUT',
  path: string,
  accessToken: string,
): Promise<T> {
  const cacheKey = createCacheKey(method, path, accessToken);

  if (method === 'GET') {
    const cached = readCache(cacheKey);
    if (cached !== undefined) return cached as T;

    // Collapse duplicate concurrent requests (e.g. React StrictMode double-invocation).
    const pending = readInflight<T>(cacheKey);
    if (pending) return pending;
  }

  const promise = (async () => {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new ApiError('The API request was not accepted.', response.status);
    }

    return (await response.json()) as T;
  })();

  if (method === 'GET') writeInflight(cacheKey, promise);

  try {
    const body = await promise;
    if (method === 'GET') writeCache(cacheKey, body);
    // Any mutation may change dashboard data; drop the cached responses.
    else clearApiCache();
    return body;
  } finally {
    if (method === 'GET') clearInflight(cacheKey);
  }
}

export const apiClient: ApiClient = {
  get: (path, accessToken) => request('GET', path, accessToken),
  put: (path, accessToken) => request('PUT', path, accessToken),
};
