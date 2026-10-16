import { apiClient, type ApiClient } from './api-client';

export interface AuthenticatedApiUser {
  id: string;
  email: string | null;
}

interface CurrentUserResponse {
  user: AuthenticatedApiUser;
}

export interface AuthApiService {
  getCurrentUser(accessToken: string): Promise<AuthenticatedApiUser>;
}

export function createAuthApiService(client: ApiClient): AuthApiService {
  return {
    async getCurrentUser(accessToken) {
      const response = await client.get<CurrentUserResponse>('/auth/me', accessToken);
      return response.user;
    },
  };
}

export const authApiService = createAuthApiService(apiClient);
