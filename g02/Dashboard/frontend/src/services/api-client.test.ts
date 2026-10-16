import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from './api-client';
import { clearApiCache } from './api-cache';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  clearApiCache();
});

describe('apiClient', () => {
  it('sends the Supabase access token as a bearer token', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3001/');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: vi.fn().mockResolvedValue({ user: { id: 'user-123', email: 'user@example.com' } }),
      ok: true,
    } as unknown as Response);

    await apiClient.get('/auth/me', 'supabase-access-token');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/auth/me', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer supabase-access-token',
      },
    });
  });

  it('sends a PUT request for model selection', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3001');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: vi.fn().mockResolvedValue({ data: null }),
      ok: true,
    } as unknown as Response);

    await apiClient.put('/dashboard/models/key/v1/selected', 'supabase-access-token');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/dashboard/models/key/v1/selected', {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer supabase-access-token',
      },
    });
  });

  it('serves a repeated GET from the client cache', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3001');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: vi.fn().mockResolvedValue({ data: { total: 1 } }),
      ok: true,
    } as unknown as Response);

    await apiClient.get('/dashboard/summary', 'cache-token');
    await apiClient.get('/dashboard/summary', 'cache-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent identical GET requests', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3001');
    let resolveJson: (value: unknown) => void = () => undefined;
    const json = new Promise((resolve) => {
      resolveJson = resolve;
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => json,
      ok: true,
    } as unknown as Response);

    const first = apiClient.get('/dashboard/model', 'dedupe-token');
    const second = apiClient.get('/dashboard/model', 'dedupe-token');
    resolveJson({ data: null });

    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('drops cached GETs after a mutation', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3001');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: vi.fn().mockResolvedValue({ data: [] }),
      ok: true,
    } as unknown as Response);

    await apiClient.get('/dashboard/models', 'mutation-token');
    await apiClient.put('/dashboard/models/key/v1/status/candidate', 'mutation-token');
    await apiClient.get('/dashboard/models', 'mutation-token');

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('exposes an HTTP status without exposing the backend response body', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3001');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401 } as Response);

    await expect(apiClient.get('/auth/me', 'expired-token')).rejects.toEqual(
      new ApiError('The API request was not accepted.', 401),
    );
  });
});
