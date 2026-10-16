export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

export interface AuthRepository {
  findUserByAccessToken(accessToken: string): Promise<AuthenticatedUser | null>;
}
