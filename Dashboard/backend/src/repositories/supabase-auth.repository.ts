import { getSupabaseAuthClient } from '../config/supabase.js';
import type { AuthRepository, AuthenticatedUser } from './auth.repository.js';

export class SupabaseAuthRepository implements AuthRepository {
  async findUserByAccessToken(accessToken: string): Promise<AuthenticatedUser | null> {
    const { data, error } = await getSupabaseAuthClient().auth.getUser(accessToken);

    if (error || !data.user) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email ?? null,
    };
  }
}
